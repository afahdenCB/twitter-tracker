import tweepy
from config import TWITTER_BEARER_TOKEN

_client = tweepy.Client(bearer_token=TWITTER_BEARER_TOKEN, wait_on_rate_limit=True)


def get_user_id(username: str) -> str:
    response = _client.get_user(username=username)
    return str(response.data.id)


def get_following(user_id: str) -> list[dict]:
    """Returns all accounts followed by user_id as {id, username, name} dicts."""
    following = []
    for page in tweepy.Paginator(
        _client.get_users_following,
        user_id,
        user_fields=["username", "name"],
        max_results=1000,
    ):
        if page.data:
            for user in page.data:
                following.append(
                    {"id": str(user.id), "username": user.username, "name": user.name}
                )
    return following
