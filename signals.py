import logging
from datetime import datetime, timezone

from config import NEW_ACCOUNT_MAX_FOLLOWERS, NEW_ACCOUNT_MAX_DAYS
from storage import load_convergence, save_convergence
from telegram_notifier import send_message

logger = logging.getLogger(__name__)

VELOCITY_THRESHOLD = 3
VELOCITY_WINDOW_DAYS = 7


def _days_ago_str(dt: datetime) -> str:
    days = (datetime.now(timezone.utc) - dt).days
    if days == 0:
        return "today"
    if days == 1:
        return "1 day ago"
    return f"{days} days ago"


def _check_new_account(user: dict, tracker_username: str) -> None:
    flags = []

    followers = user.get("followers_count")
    if followers is not None and followers < NEW_ACCOUNT_MAX_FOLLOWERS:
        flags.append(f"{followers:,} followers")

    created_at_str = user.get("created_at")
    if created_at_str:
        created_at = datetime.fromisoformat(created_at_str)
        age_days = (datetime.now(timezone.utc) - created_at).days
        if age_days < NEW_ACCOUNT_MAX_DAYS:
            age_str = f"{age_days // 30}mo old" if age_days >= 30 else f"{age_days}d old"
            flags.append(f"created {age_str}")

    if flags:
        msg = (
            f"👀 <b>@{tracker_username}</b> followed <b>@{user['username']}</b>"
            f" — {', '.join(flags)}"
        )
        logger.info(msg)
        send_message(msg)


def _check_convergence(entry: dict, user: dict) -> None:
    followed_by = entry["followed_by"]
    count = len(followed_by)
    if count < 2:
        return

    parts = []
    for acct, ts in sorted(followed_by.items(), key=lambda x: x[1]):
        dt = datetime.fromisoformat(ts)
        parts.append(f"@{acct} ({_days_ago_str(dt)})")

    msg = (
        f"🔗 <b>{count} tracked accounts</b> follow"
        f" <b>@{user['username']}</b> ({user['name']})\n"
        + ", ".join(parts)
    )
    logger.info(msg)
    send_message(msg)


def _check_velocity(entry: dict, user: dict) -> None:
    now_dt = datetime.now(timezone.utc)
    recent = [
        acct for acct, ts in entry["followed_by"].items()
        if (now_dt - datetime.fromisoformat(ts)).days <= VELOCITY_WINDOW_DAYS
    ]
    if len(recent) == VELOCITY_THRESHOLD:
        msg = (
            f"⚡ <b>{VELOCITY_THRESHOLD} tracked accounts</b> followed"
            f" <b>@{user['username']}</b> within {VELOCITY_WINDOW_DAYS} days:"
            f" {', '.join(f'@{a}' for a in recent)}"
        )
        logger.info(msg)
        send_message(msg)


def process_new_follow(user: dict, tracker_username: str) -> None:
    """Run all signal checks for a newly detected follow."""
    index = load_convergence()
    user_id = user["id"]
    is_first = user_id not in index

    if is_first:
        _check_new_account(user, tracker_username)
        index[user_id] = {"username": user["username"], "name": user["name"], "followed_by": {}}

    index[user_id]["username"] = user["username"]
    index[user_id]["name"] = user["name"]
    index[user_id]["followed_by"][tracker_username] = datetime.now(timezone.utc).isoformat()
    save_convergence(index)

    _check_convergence(index[user_id], user)
    _check_velocity(index[user_id], user)
