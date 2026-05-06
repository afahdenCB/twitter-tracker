import os
from dotenv import load_dotenv

load_dotenv()

TELEGRAM_BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
TELEGRAM_CHAT_ID = os.environ["TELEGRAM_CHAT_ID"]
POLL_INTERVAL_MINUTES = int(os.getenv("POLL_INTERVAL_MINUTES", "60"))
NEW_ACCOUNT_MAX_FOLLOWERS = int(os.getenv("NEW_ACCOUNT_MAX_FOLLOWERS", "1000"))
NEW_ACCOUNT_MAX_DAYS = int(os.getenv("NEW_ACCOUNT_MAX_DAYS", "180"))

# Build scraper account pool from numbered env vars: TWITTER_ACCOUNT_1_*, TWITTER_ACCOUNT_2_*, ...
# Falls back to single-account TWITTER_USERNAME/EMAIL/PASSWORD/COOKIES if no numbered vars found.
def _load_accounts() -> list[dict]:
    accounts = []
    i = 1
    while True:
        username = os.getenv(f"TWITTER_ACCOUNT_{i}_USERNAME")
        if not username:
            break
        accounts.append({
            "username": username,
            "email": os.getenv(f"TWITTER_ACCOUNT_{i}_EMAIL", ""),
            "password": os.getenv(f"TWITTER_ACCOUNT_{i}_PASSWORD", ""),
            "cookies": os.getenv(f"TWITTER_ACCOUNT_{i}_COOKIES", ""),
        })
        i += 1

    if not accounts:
        accounts.append({
            "username": os.environ["TWITTER_USERNAME"],
            "email": os.environ["TWITTER_EMAIL"],
            "password": os.environ["TWITTER_PASSWORD"],
            "cookies": os.getenv("TWITTER_COOKIES", ""),
        })

    return accounts

TWITTER_ACCOUNTS = _load_accounts()
