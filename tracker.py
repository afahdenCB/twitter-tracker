import asyncio
import logging
import random
from datetime import datetime, timezone
from twitter_client import get_user_info, get_following
from storage import load_following, save_following, load_meta, save_meta, append_feed, load_feed
from telegram_notifier import send_message
from signals import process_new_follow

logger = logging.getLogger(__name__)

# Number of full-fetch cycles to accumulate before alerting on any account.
# Pagination from Twitter's API is unstable — a single fetch can silently miss
# 10–20% of an account's follows. Accumulating over multiple cycles fills those
# gaps before alerts are enabled, eliminating false positives from baseline holes.
BASELINE_CYCLES_REQUIRED = 3


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
    baseline_complete = meta.get("baseline_complete", False)
    baseline_cycles = meta.get("baseline_cycles", 0)

    now_iso = datetime.now(timezone.utc).isoformat()

    # Baseline-building mode: accumulate BASELINE_CYCLES_REQUIRED full fetches
    # before alerting. This compensates for Twitter's unstable pagination — a
    # single fetch can silently miss 10–20% of an account's follows, and those
    # gaps would fire as false-positive alerts once the count changes.
    # Defaults to False so existing accounts re-accumulate on the next deploy.
    if not baseline_complete:
        cycle_num = baseline_cycles + 1
        is_first_run = not stored_following
        label = "first run" if is_first_run else f"cycle {cycle_num}/{BASELINE_CYCLES_REQUIRED}"
        logger.info(f"@{username}: baseline building ({label}), fetching full list...")

        current_following = {u["id"]: u for u in await get_following(user_id)}

        if not current_following:
            logger.warning(f"@{username}: empty fetch during baseline building ({label}), skipping")
            return

        merged = {**stored_following, **current_following}
        is_complete = cycle_num >= BASELINE_CYCLES_REQUIRED
        coverage = min(len(merged) / current_count, 1.0) if current_count > 0 else 1.0

        logger.info(
            f"@{username}: baseline {label} — {len(merged)} accounts in baseline "
            f"({coverage:.0%} of reported {current_count})"
            + (" — COMPLETE, alerting now enabled" if is_complete else "")
        )

        save_following(username, merged)
        save_meta(username, {
            **meta,
            "user_id": user_id,
            "following_count": current_count,
            "checked_at": now_iso,
            "baseline_complete": is_complete,
            "baseline_cycles": cycle_num,
        })
        return

    # Normal alert mode: skip full fetch if following count hasn't changed
    if current_count == stored_count:
        logger.info(f"@{username}: following count unchanged ({current_count}), skipping full fetch")
        save_meta(username, {**meta, "checked_at": now_iso})
        return

    logger.info(f"@{username}: following count changed ({stored_count} → {current_count}), fetching full list")
    current_following = {u["id"]: u for u in await get_following(user_id)}
    if _is_partial_fetch(current_following, current_count, username):
        return
    new_follows = [u for uid, u in current_following.items() if uid not in stored_following]

    # Belt-and-suspenders: even if the baseline gets out of sync, never alert
    # for a follow that's already recorded in the feed.
    if new_follows:
        feed = load_feed()
        alerted_ids = {e["followed_id"] for e in feed if e.get("tracker") == username}
        deduplicated = [u for u in new_follows if u["id"] not in alerted_ids]
        suppressed = len(new_follows) - len(deduplicated)
        if suppressed:
            logger.warning(f"@{username}: suppressed {suppressed} duplicate alert(s) already in feed")
        new_follows = deduplicated

    # If an implausibly large number of "new" follows appear in one cycle, the
    # baseline is stale or corrupt. Re-baseline silently rather than spamming.
    if len(new_follows) > 25:
        logger.warning(
            f"@{username}: {len(new_follows)} new follows detected in one cycle — "
            f"baseline looks stale, re-baselining silently"
        )
        save_following(username, {**stored_following, **current_following})
        save_meta(username, {**meta, "user_id": user_id, "following_count": current_count, "checked_at": now_iso})
        return

    # Save merged baseline before alerting — if the write fails the exception
    # propagates before any notification fires, ensuring clean retry next cycle.
    merged_following = {**stored_following, **current_following}
    save_following(username, merged_following)
    save_meta(username, {**meta, "user_id": user_id, "following_count": current_count, "checked_at": now_iso})

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
            "account_created_at": user.get("created_at"),
            "bio": user.get("bio", ""),
            "detected_at": datetime.now(timezone.utc).isoformat(),
        })
        process_new_follow(user, username)


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
