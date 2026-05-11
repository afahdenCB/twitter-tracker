# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## What this project does

Polls Twitter/X at a configurable interval to detect when tracked accounts follow new accounts, then sends Telegram alerts.

## Production deployment

Three components, each deployed separately:

| Component | Where | Details |
|---|---|---|
| Tracker (`main.py`) | GCP VM | `twitter-tracker-vm`, us-central1-a, personal GCP project `twitter-tracker-2025` |
| API (`api.py`) | Cloud Run | `https://twitter-tracker-api-576248526926.us-central1.run.app` |
| Frontend (`web/`) | Vercel | `https://twitter-tracker-chi.vercel.app` — connected to `master` |

**State** is stored in GCS bucket `twitter-tracker-data-personal` (us-central1). All `storage.py` reads/writes go there — no local files in production.

### Updating the tracker (VM)

```bash
# SSH in
gcloud compute ssh twitter-tracker-vm --zone=us-central1-a --tunnel-through-iap --project=twitter-tracker-2025

# Pull latest and restart
cd ~/twitter-tracker-git && git pull && cp *.py ~/twitter-tracker/ && sudo systemctl restart tracker

# Check logs
sudo systemctl status tracker
sudo journalctl -u tracker -f
```

### Updating the API (Cloud Run)

Run from the repo root on your Mac:

```bash
gcloud run deploy twitter-tracker-api --source . --region=us-central1 --project=twitter-tracker-2025
```

### Updating the frontend (Vercel)

Push to the branch Vercel is watching — it auto-deploys.

### Checking GCS data

```bash
gcloud storage ls gs://twitter-tracker-data-personal/ --project=twitter-tracker-2025
```

### Uploading data to GCS (e.g. seeding baseline)

```bash
gcloud storage cp data/* gs://twitter-tracker-data-personal/ --project=twitter-tracker-2025
```

### Adding/removing tracked accounts

Use the web UI (Accounts page), or edit `accounts.json` directly in GCS:
```bash
gcloud storage cat gs://twitter-tracker-data-personal/accounts.json --project=twitter-tracker-2025
```

## Environment variables

### Tracker VM (`.env` on the VM at `~/twitter-tracker/.env`)

| Variable | Description |
|---|---|
| `GCS_BUCKET` | GCS bucket name (`twitter-tracker-data-personal`) |
| `TELEGRAM_BOT_TOKEN` | Token from @BotFather |
| `TELEGRAM_CHAT_ID` | Target chat/channel ID |
| `POLL_INTERVAL_MINUTES` | How often to poll (default: 60) |
| `TWITTER_ACCOUNT_1_USERNAME` | Scraper account username |
| `TWITTER_ACCOUNT_1_COOKIES` | Scraper account cookies |

### Cloud Run API (env vars set in Cloud Run config)

| Variable | Value |
|---|---|
| `GCS_BUCKET` | `twitter-tracker-data-personal` |
| `POLL_INTERVAL_MINUTES` | `60` |
| `CORS_ORIGINS` | `https://twitter-tracker-chi.vercel.app` |

### Vercel frontend

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://twitter-tracker-api-576248526926.us-central1.run.app` |

## Architecture

```
Vercel (Next.js) → Cloud Run API (api.py) → GCS bucket
                                                 ↑
                   VM tracker (main.py) ─────────┘
```

The flow on each poll cycle:

```
main.py → tracker.check_all()
           └── tracker.check_account(username)
                ├── twitter_client.get_user_info(username)
                ├── twitter_client.get_following(user_id)
                ├── storage.load_following(username)         # from GCS
                ├── diff → new follows detected
                ├── telegram_notifier.send_message(...)
                ├── storage.append_feed(...)                 # to GCS feed.jsonl
                └── storage.save_following(username, ...)    # to GCS
```

**First run behavior**: On the first poll for an account, the current following list is saved as a baseline with no alerts sent. Alerts only fire on subsequent runs when a new follow appears.

**State persistence**: All state lives in GCS (`twitter-tracker-data-personal`):
- `<username>.json` — last-known following list
- `<username>.meta.json` — following count + last checked timestamp
- `accounts.json` — list of tracked usernames (editable via web UI)
- `feed.jsonl` — append-only log of all detected follows
- `convergence.json` — index of who multiple trackers follow in common
- `status.json` — last poll cycle timestamp

## Module responsibilities

- `main.py` — entry point; scheduling loop
- `tracker.py` — core diffing logic; catches and logs exceptions per account
- `twitter_client.py` — twscrape wrapper; cookie-based auth, multi-account pool
- `storage.py` — GCS read/write for all state
- `api.py` — FastAPI backend; reads/writes GCS via storage.py
- `telegram_notifier.py` — single `send_message()` using raw `requests`
- `signals.py` — convergence and velocity signal detection
- `config.py` — loads `.env` and exposes typed constants
