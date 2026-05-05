import json
import os
from dotenv import load_dotenv

load_dotenv()

TELEGRAM_BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
TELEGRAM_CHAT_ID = os.environ["TELEGRAM_CHAT_ID"]
POLL_INTERVAL_MINUTES = int(os.getenv("POLL_INTERVAL_MINUTES", "60"))
NEW_ACCOUNT_MAX_FOLLOWERS = int(os.getenv("NEW_ACCOUNT_MAX_FOLLOWERS", "1000"))
NEW_ACCOUNT_MAX_DAYS = int(os.getenv("NEW_ACCOUNT_MAX_DAYS", "180"))

# Multi-account scraper pool.
# If TWITTER_ACCOUNTS is set (JSON array), use it.
# Otherwise fall back to single-account TWITTER_USERNAME/EMAIL/PASSWORD/COOKIES.
_accounts_raw = os.getenv("TWITTER_ACCOUNTS")
if _accounts_raw:
    TWITTER_ACCOUNTS = json.loads(_accounts_raw)
else:
    TWITTER_ACCOUNTS = [{
        "username": os.environ["TWITTER_USERNAME"],
        "email": os.environ["TWITTER_EMAIL"],
        "password": os.environ["TWITTER_PASSWORD"],
        "cookies": os.getenv("TWITTER_COOKIES", ""),
    }]
