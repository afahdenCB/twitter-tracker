# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## What this project does

Polls Twitter/X at a configurable interval to detect when tracked accounts follow new accounts, then sends Telegram alerts.

## Setup & running

```bash
pip install -r requirements.txt
cp .env.example .env   # then fill in real values
python main.py
```

## Environment variables (`.env`)

| Variable | Description |
|---|---|
| `TWITTER_BEARER_TOKEN` | Twitter API v2 Bearer Token (requires Basic tier or above for `/following`) |
| `TELEGRAM_BOT_TOKEN` | Token from @BotFather |
| `TELEGRAM_CHAT_ID` | Target chat/channel ID (use @userinfobot to find it) |
| `TRACKED_ACCOUNTS` | Comma-separated Twitter usernames to monitor |
| `POLL_INTERVAL_MINUTES` | How often to poll (default: 15) |

## Architecture

The flow on each poll cycle:

```
main.py → tracker.check_all()
           └── tracker.check_account(username)
                ├── twitter_client.get_user_id(username)
                ├── twitter_client.get_following(user_id)   # paginates all pages
                ├── storage.load_following(username)         # from data/<username>.json
                ├── diff → new follows detected
                ├── telegram_notifier.send_message(...)      # per new follow
                └── storage.save_following(username, ...)    # only on change
```

**First run behavior**: On the first poll for an account, the current following list is saved as a baseline with no alerts sent. Alerts only fire on subsequent runs when a new follow appears.

**State persistence**: `data/<username>.json` stores the last-known following list as `{user_id: {id, username, name}}`. This directory is created automatically.

## Module responsibilities

- `main.py` — entry point; scheduling loop using `schedule` + `time.sleep(30)`
- `tracker.py` — core diffing logic; catches and logs exceptions per account to avoid one failure blocking others
- `twitter_client.py` — tweepy v2 wrapper; paginates `get_users_following` with `wait_on_rate_limit=True`
- `storage.py` — JSON read/write for state in `data/`
- `telegram_notifier.py` — single `send_message()` using raw `requests` to Telegram Bot API
- `config.py` — loads `.env` and exposes typed constants

## Twitter API notes

The `GET /2/users/:id/following` endpoint requires at least the **Basic tier** ($100/month) of the Twitter/X API. The free tier does not include this endpoint.
