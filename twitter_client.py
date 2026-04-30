import logging
from contextlib import aclosing
from twscrape import API
from config import TWITTER_USERNAME, TWITTER_EMAIL, TWITTER_PASSWORD

logger = logging.getLogger(__name__)

_api = API()
_initialized = False


async def _ensure_initialized() -> None:
    global _initialized
    if _initialized:
        return
    await _api.pool.add_account(
        username=TWITTER_USERNAME,
        password=TWITTER_PASSWORD,
        email=TWITTER_EMAIL,
        email_password="",
    )
    await _api.pool.login_all()
    logger.info("twscrape account logged in")
    _initialized = True


async def get_user_id(username: str) -> str:
    await _ensure_initialized()
    user = await _api.user_by_login(username)
    return str(user.id)


async def get_following(user_id: str) -> list[dict]:
    """Returns all accounts followed by user_id as {id, username, name} dicts."""
    await _ensure_initialized()
    following = []
    async with aclosing(_api.following(int(user_id))) as gen:
        async for user in gen:
            following.append({"id": str(user.id), "username": user.username, "name": user.displayname})
    return following
