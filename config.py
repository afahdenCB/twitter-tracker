import os
from dotenv import load_dotenv

load_dotenv()

TWITTER_USERNAME = os.environ["TWITTER_USERNAME"]
TWITTER_EMAIL = os.environ["TWITTER_EMAIL"]
TWITTER_PASSWORD = os.environ["TWITTER_PASSWORD"]
TWITTER_COOKIES = os.getenv("TWITTER_COOKIES", "")
TELEGRAM_BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
TELEGRAM_CHAT_ID = os.environ["TELEGRAM_CHAT_ID"]
TRACKED_ACCOUNTS = [u.strip() for u in os.environ["TRACKED_ACCOUNTS"].split(",")]
POLL_INTERVAL_MINUTES = int(os.getenv("POLL_INTERVAL_MINUTES", "60"))
NEW_ACCOUNT_MAX_FOLLOWERS = int(os.getenv("NEW_ACCOUNT_MAX_FOLLOWERS", "1000"))
NEW_ACCOUNT_MAX_DAYS = int(os.getenv("NEW_ACCOUNT_MAX_DAYS", "180"))
