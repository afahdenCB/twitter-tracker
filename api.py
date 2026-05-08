import os
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
import json

from dotenv import dotenv_values
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()
_cors_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path("data")
ENV_PATH = Path(".env")


def _read_tracked_accounts() -> list[str]:
    return [
        u.strip()
        for u in dotenv_values(".env").get("TRACKED_ACCOUNTS", "").split(",")
        if u.strip()
    ]


def _write_tracked_accounts(accounts: list[str]) -> None:
    content = ENV_PATH.read_text()
    new_line = f"TRACKED_ACCOUNTS={','.join(accounts)}"
    content = re.sub(r"^TRACKED_ACCOUNTS=.*$", new_line, content, flags=re.MULTILINE)
    ENV_PATH.write_text(content)


@app.get("/api/accounts")
def get_accounts():
    # Build last_new_follow index from feed in one pass
    last_follow: dict[str, str] = {}
    feed_path = DATA_DIR / "feed.jsonl"
    if feed_path.exists():
        for line in feed_path.read_text().splitlines():
            if not line.strip():
                continue
            entry = json.loads(line)
            tracker = entry.get("tracker", "")
            ts = entry.get("detected_at", "")
            if tracker and ts and ts > last_follow.get(tracker, ""):
                last_follow[tracker] = ts

    result = []
    for username in _read_tracked_accounts():
        meta_path = DATA_DIR / f"{username}.meta.json"
        meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
        result.append({
            "username": username,
            "following_count": meta.get("following_count"),
            "baselined": meta_path.exists(),
            "last_checked": meta.get("checked_at"),
            "last_new_follow": last_follow.get(username),
        })
    return result


class AddAccountBody(BaseModel):
    username: str


@app.post("/api/accounts")
def add_account(body: AddAccountBody):
    username = body.username.strip().lstrip("@")
    if not username:
        raise HTTPException(status_code=400, detail="username required")
    accounts = _read_tracked_accounts()
    if username in accounts:
        raise HTTPException(status_code=409, detail="already tracked")
    accounts.append(username)
    _write_tracked_accounts(accounts)
    return {"username": username}


@app.delete("/api/accounts/{username}")
def remove_account(username: str):
    accounts = _read_tracked_accounts()
    if username not in accounts:
        raise HTTPException(status_code=404, detail="not found")
    accounts.remove(username)
    _write_tracked_accounts(accounts)
    return {"username": username}


@app.get("/api/status")
def get_status():
    status_path = DATA_DIR / "status.json"
    status = json.loads(status_path.read_text()) if status_path.exists() else {}
    poll_interval = int(dotenv_values(".env").get("POLL_INTERVAL_MINUTES", "60"))

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
    path = DATA_DIR / "convergence.json"
    if not path.exists():
        return []

    index = json.loads(path.read_text())
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


@app.get("/api/feed")
def get_feed(
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    tracker: list[str] = Query(None),
):
    path = DATA_DIR / "feed.jsonl"
    if not path.exists():
        return {"items": [], "total": 0}
    entries = [
        json.loads(line)
        for line in path.read_text().splitlines()
        if line.strip()
    ]
    if tracker:
        tracker_set = set(tracker)
        entries = [e for e in entries if e.get("tracker") in tracker_set]
    entries.reverse()
    return {"items": entries[offset : offset + limit], "total": len(entries)}
