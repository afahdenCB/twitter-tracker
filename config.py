import os
from dotenv import load_dotenv

load_dotenv()

TWITTER_BEARER_TOKEN = os.environ["TWITTER_BEARER_TOKEN"]
TELEGRAM_BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
TELEGRAM_CHAT_ID = os.environ["TELEGRAM_CHAT_ID"]
TRACKED_ACCOUNTS = [u.strip() for u in os.environ["TRACKED_ACCOUNTS"].split(",")]
POLL_INTERVAL_MINUTES = int(os.getenv("POLL_INTERVAL_MINUTES", "15"))
