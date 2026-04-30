import asyncio
import logging
import random
from twitter_client import get_user_id, get_following
from storage import load_following, save_following
from telegram_notifier import send_message
from config import TRACKED_ACCOUNTS

logger = logging.getLogger(__name__)


async def check_account(username: str) -> None:
    logger.info(f"Checking @{username}...")
    user_id = await get_user_id(username)
    current_following = {u["id"]: u for u in await get_following(user_id)}
    stored_following = load_following(username)

    if not stored_following:
        logger.info(f"First run for @{username}: stored {len(current_following)} accounts as baseline")
        save_following(username, current_following)
        return

    new_follows = [u for uid, u in current_following.items() if uid not in stored_following]

    for user in new_follows:
        msg = f"🔔 <b>@{username}</b> just followed <b>@{user['username']}</b> ({user['name']})"
        logger.info(msg)
        send_message(msg)

    if new_follows:
        save_following(username, current_following)


async def check_all() -> None:
    for username in TRACKED_ACCOUNTS:
        try:
            await check_account(username)
        except Exception:
            logger.exception(f"Error checking @{username}")
        await asyncio.sleep(random.uniform(10, 20))
