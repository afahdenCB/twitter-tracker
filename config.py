import os
from dotenv import load_dotenv

load_dotenv()

TWITTER_USERNAME = os.environ["TWITTER_USERNAME"]
TWITTER_EMAIL = os.environ["TWITTER_EMAIL"]
TWITTER_PASSWORD = os.environ["TWITTER_PASSWORD"]
TELEGRAM_BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
TELEGRAM_CHAT_ID = os.environ["TELEGRAM_CHAT_ID"]
TRACKED_ACCOUNTS = [u.strip() for u in os.environ["TRACKED_ACCOUNTS"].split(",")]
POLL_INTERVAL_MINUTES = int(os.getenv("POLL_INTERVAL_MINUTES", "60"))
