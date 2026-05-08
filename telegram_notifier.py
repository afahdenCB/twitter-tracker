import requests
from config import TELEGRAM_BOT_TOKEN
from dotenv import dotenv_values


def send_message(text: str) -> None:
    chat_id = dotenv_values(".env").get("TELEGRAM_CHAT_ID")
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    response = requests.post(url, json=payload, timeout=10)
    response.raise_for_status()
