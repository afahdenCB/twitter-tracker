import os
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import storage

app = FastAPI()
_cors_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/accounts")
def get_accounts():
    last_follow: dict[str, str] = {}
    for entry in storage.load_feed():
        tracker = entry.get("tracker", "")
        ts = entry.get("detected_at", "")
        if tracker and ts and ts > last_follow.get(tracker, ""):
            last_follow[tracker] = ts

    result = []
    for username in storage.load_tracked_accounts():
        meta = storage.load_meta(username)
        result.append({
            "username": username,
            "following_count": meta.get("following_count"),
            "baselined": bool(meta),
            "last_checked": meta.get("checked_at"),
            "last_new_follow": last_follow.get(username),
        })
    return result


class AddAccountBody(BaseModel):
    username: str


@app.post("/api/accounts")
def add_account(body: AddAccountBody):
    raw = body.username.strip()
    # Accept full URLs like https://x.com/username or https://twitter.com/username
    if "/" in raw:
        raw = raw.rstrip("/").split("/")[-1]
    username = raw.lstrip("@")
    if not username:
        raise HTTPException(status_code=400, detail="username required")
    accounts = storage.load_tracked_accounts()
    if username in accounts:
        raise HTTPException(status_code=409, detail="already tracked")
    accounts.append(username)
    storage.save_tracked_accounts(accounts)
    return {"username": username}


@app.delete("/api/accounts/{username}")
def remove_account(username: str):
    accounts = storage.load_tracked_accounts()
    if username not in accounts:
        raise HTTPException(status_code=404, detail="not found")
    accounts.remove(username)
    storage.save_tracked_accounts(accounts)
    return {"username": username}


@app.get("/api/status")
def get_status():
    status = storage.load_status()
    poll_interval = int(os.getenv("POLL_INTERVAL_MINUTES", "60"))

    eta_minutes = None
    if status.get("last_cycle_started_at"):
        last = datetime.fromisoformat(status["last_cycle_started_at"])
        elapsed = (datetime.now(timezone.utc) - last).total_seconds() / 60
        eta_minutes = max(0, round(poll_interval - elapsed))

    return {
        "last_cycle_started_at": status.get("last_cycle_started_at"),
        "poll_interval_minutes": poll_interval,
        "next_cycle_eta_minutes": eta_minutes,
    }


@app.get("/api/convergence")
def get_convergence(
    min_count: int = Query(2, ge=1),
    days: int = Query(None, ge=1),
):
    index = storage.load_convergence()
    cutoff = (
        (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        if days
        else None
    )

    results = []
    for user_id, entry in index.items():
        followed_by = entry["followed_by"]
        filtered = (
            {acct: ts for acct, ts in followed_by.items() if ts >= cutoff}
            if cutoff
            else followed_by
        )
        if len(filtered) < min_count:
            continue

        results.append({
            "user_id": user_id,
            "username": entry["username"],
            "name": entry["name"],
            "bio": entry.get("bio", ""),
            "followers_count": entry.get("followers_count"),
            "followed_by": [
                {"tracker": acct, "at": ts}
                for acct, ts in sorted(filtered.items(), key=lambda x: x[1])
            ],
            "count": len(filtered),
            "latest_follow": max(filtered.values()),
        })

    results.sort(key=lambda x: (x["count"], x["latest_follow"]), reverse=True)
    return results


@app.get("/api/tags")
def get_tags():
    return storage.load_tags()


class CreateTagBody(BaseModel):
    name: str


@app.post("/api/tags")
def create_tag(body: CreateTagBody):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="name required")
    data = storage.load_tags()
    if name in data["tags"]:
        raise HTTPException(status_code=409, detail="tag already exists")
    data["tags"].append(name)
    storage.save_tags(data)
    return data


@app.delete("/api/tags/{name}")
def delete_tag(name: str):
    data = storage.load_tags()
    if name not in data["tags"]:
        raise HTTPException(status_code=404, detail="tag not found")
    data["tags"].remove(name)
    for username in data["account_tags"]:
        data["account_tags"][username] = [
            t for t in data["account_tags"][username] if t != name
        ]
    storage.save_tags(data)
    return data


class SetAccountTagsBody(BaseModel):
    tags: list[str]


@app.put("/api/accounts/{username}/tags")
def set_account_tags(username: str, body: SetAccountTagsBody):
    data = storage.load_tags()
    invalid = [t for t in body.tags if t not in data["tags"]]
    if invalid:
        raise HTTPException(status_code=400, detail=f"unknown tags: {invalid}")
    data["account_tags"][username] = body.tags
    storage.save_tags(data)
    return data


@app.get("/api/feed")
def get_feed(
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    tracker: list[str] = Query(None),
    max_account_age_days: int = Query(None, ge=1),
):
    entries = storage.load_feed()
    if tracker:
        tracker_set = set(tracker)
        entries = [e for e in entries if e.get("tracker") in tracker_set]
    if max_account_age_days is not None:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=max_account_age_days)).isoformat()
        entries = [
            e for e in entries
            if e.get("account_created_at") and e["account_created_at"] >= cutoff
        ]
    entries.reverse()
    return {"items": entries[offset: offset + limit], "total": len(entries)}
