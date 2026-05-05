from datetime import datetime, timedelta, timezone
from pathlib import Path
import json

from dotenv import dotenv_values
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path("data")


@app.get("/api/accounts")
def get_accounts():
    accounts = [
        u.strip()
        for u in dotenv_values(".env").get("TRACKED_ACCOUNTS", "").split(",")
        if u.strip()
    ]
    result = []
    for username in accounts:
        meta_path = DATA_DIR / f"{username}.meta.json"
        meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
        result.append({
            "username": username,
            "following_count": meta.get("following_count"),
        })
    return result


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
            "followed_by": [
                {"tracker": acct, "at": ts}
                for acct, ts in sorted(filtered.items(), key=lambda x: x[1], reverse=True)
            ],
            "count": len(filtered),
            "latest_follow": max(filtered.values()),
        })

    results.sort(key=lambda x: (-x["count"], x["latest_follow"]), reverse=False)
    results.sort(key=lambda x: x["count"], reverse=True)
    return results


@app.get("/api/feed")
def get_feed(
    limit: int = Query(100, ge=1, le=1000),
    tracker: str = Query(None),
):
    path = DATA_DIR / "feed.jsonl"
    if not path.exists():
        return []
    entries = [
        json.loads(line)
        for line in path.read_text().splitlines()
        if line.strip()
    ]
    if tracker:
        entries = [e for e in entries if e.get("tracker") == tracker]
    entries.reverse()
    return entries[:limit]
