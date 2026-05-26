import asyncio
import logging
import random
from datetime import datetime, timezone
from twitter_client import get_user_info, get_following
from storage import load_following, save_following, load_meta, save_meta, append_feed
from telegram_notifier import send_message
from signals import process_new_follow

logger = logging.getLogger(__name__)


def _fmt_followers(count: int) -> str:
    if count >= 1_000_000:
        return f"{count / 1_000_000:.1f}M"
    if count >= 1_000:
        return f"{count / 1_000:.1f}K"
    return str(count)


def _fmt_age(created_at_str: str) -> str:
    created = datetime.fromisoformat(created_at_str)
    days = (datetime.now(timezone.utc) - created).days
    years, remainder = divmod(days, 365)
    months = remainder // 30
    if years and months:
        return f"{years}y {months}mo"
    if years:
        return f"{years}y"
    if months:
        return f"{months}mo"
    return f"{days}d"


def _is_partial_fetch(fetched: dict, expected_count: int, username: str) -> bool:
    """Return True if get_following returned far fewer accounts than Twitter reports.

    Twitter's following count is approximate, so we allow 20% slack. Below that
    threshold the fetch almost certainly hit a rate limit mid-pagination and we
    should skip saving to avoid writing a corrupt baseline.
    """
    if expected_count > 0 and len(fetched) < expected_count * 0.8:
        logger.warning(
            f"@{username}: partial fetch detected — got {len(fetched)} accounts "
            f"but API reports {expected_count} (skipping to avoid bad baseline)"
        )
        return True
    return False


async def check_account(username: str) -> None:
    logger.info(f"Checking @{username}...")
    user_info = await get_user_info(username)
    user_id = user_info["id"]
    current_count = user_info["following_count"]

    meta = load_meta(username)
    stored_count = meta.get("following_count")
    stored_following = load_following(username)

    now_iso = datetime.now(timezone.utc).isoformat()

    # First run: establish baseline without alerting
    if not stored_following:
        current_following = {u["id"]: u for u in await get_following(user_id)}
        if _is_partial_fetch(current_following, current_count, username):
            return
        logger.info(f"First run for @{username}: stored {len(current_following)} accounts as baseline")
        save_following(username, current_following)
        save_meta(username, {"user_id": user_id, "following_count": current_count, "checked_at": now_iso})
        return

    # Skip full fetch if following count hasn't changed
    if current_count == stored_count:
        logger.info(f"@{username}: following count unchanged ({current_count}), skipping full fetch")
        save_meta(username, {**meta, "checked_at": now_iso})
        return

    logger.info(f"@{username}: following count changed ({stored_count} → {current_count}), fetching full list")
    current_following = {u["id"]: u for u in await get_following(user_id)}
    if _is_partial_fetch(current_following, current_count, username):
        return
    new_follows = [u for uid, u in current_following.items() if uid not in stored_following]

    # If an implausibly large number of "new" follows appear in one cycle, the
    # baseline is stale or corrupt. Re-baseline silently rather than spamming.
    if len(new_follows) > 25:
        logger.warning(
            f"@{username}: {len(new_follows)} new follows detected in one cycle — "
            f"baseline looks stale, re-baselining silently"
        )
        save_following(username, current_following)
        save_meta(username, {"user_id": user_id, "following_count": current_count, "checked_at": now_iso})
        return

    for user in new_follows:
        profile_url = f"https://x.com/{user['username']}"
        followers_str = _fmt_followers(user["followers_count"]) if user.get("followers_count") is not None else "?"
        age_str = _fmt_age(user["created_at"]) if user.get("created_at") else "?"
        bio = user.get("bio", "").strip()
        bio_line = f"\n💬 {bio}" if bio else ""
        msg = (
            f"🔔 <b>@{username}</b> followed"
            f" <a href=\"{profile_url}\"><b>@{user['username']}</b></a> ({user['name']})\n"
            f"👥 {followers_str} followers · 📅 {age_str} old"
            f"{bio_line}"
        )
        logger.info(msg)
        send_message(msg)
        append_feed({
            "tracker": username,
            "followed_id": user["id"],
            "followed_username": user["username"],
            "followed_name": user["name"],
            "followers_count": user.get("followers_count"),
            "bio": user.get("bio", ""),
            "detected_at": datetime.now(timezone.utc).isoformat(),
        })
        process_new_follow(user, username)

    save_following(username, current_following)
    save_meta(username, {"user_id": user_id, "following_count": current_count, "checked_at": now_iso})


async def check_all() -> None:
    from datetime import datetime, timezone as _tz
    from config import TWITTER_ACCOUNTS
    from storage import save_status, load_tracked_accounts

    save_status({"last_cycle_started_at": datetime.now(_tz.utc).isoformat()})
    accounts = load_tracked_accounts()

    # Run up to one check per scraper account concurrently.
    # Small jitter inside the semaphore spaces out requests on each slot.
    sem = asyncio.Semaphore(len(TWITTER_ACCOUNTS))

    async def _check(username: str) -> None:
        async with sem:
            try:
                await check_account(username)
            except Exception:
                logger.exception(f"Error checking @{username}")
            await asyncio.sleep(random.uniform(3, 8))

    await asyncio.gather(*[_check(u) for u in accounts])
