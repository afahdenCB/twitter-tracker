import logging
from contextlib import aclosing
from twscrape import API
import twscrape.xclid as _xclid
from config import TWITTER_USERNAME, TWITTER_EMAIL, TWITTER_PASSWORD, TWITTER_COOKIES

# twscrape 0.17.0 scrapes x.com to compute x-client-transaction-id but the page
# structure changed and parsing breaks. Twitter accepts any value for this header,
# so we stub the generator to skip the broken scraping step.
async def _stub_xclid_create(clt=None):
    return _xclid.XClIdGen(vk_bytes=[0] * 35, anim_key="AAAAAAAAAAAAAAAAAAAAAA==")

_xclid.XClIdGen.create = _stub_xclid_create

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
        cookies=TWITTER_COOKIES or None,
    )
    if not TWITTER_COOKIES:
        await _api.pool.login_all()
        logger.info("twscrape account logged in via password")
    else:
        logger.info("twscrape account initialized via cookies")
    _initialized = True


async def get_user_info(username: str) -> dict:
    """Returns {id, following_count} for the given username (single request)."""
    await _ensure_initialized()
    user = await _api.user_by_login(username)
    return {"id": str(user.id), "following_count": user.friendsCount}


async def get_following(user_id: str) -> list[dict]:
    """Returns all accounts followed by user_id as enriched dicts."""
    await _ensure_initialized()
    following = []
    async with aclosing(_api.following(int(user_id))) as gen:
        async for user in gen:
            following.append({
                "id": str(user.id),
                "username": user.username,
                "name": user.displayname,
                "followers_count": user.followersCount,
                "created_at": user.created.isoformat(),
                "bio": user.rawDescription or "",
            })
    return following
