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

## Scraper accounts

The tracker uses **scraper accounts** — ordinary Twitter/X accounts whose cookies are used by twscrape to fetch following lists. These are not the accounts being tracked; they are the accounts doing the fetching. Using dedicated dummy accounts keeps your personal account safe from any rate limiting or suspension risk.

### Why cookies, not a password

Twitter's API requires authentication. twscrape authenticates by replaying browser cookies rather than going through OAuth, which is more reliable for scraping. Cookies expire periodically (typically every few months) and need to be refreshed when they do.

### Creating a scraper account

1. Create a new Twitter/X account (use a throwaway email — e.g. a Gmail alias)
2. Log in via Chrome and let it sit for a day or two so it doesn't look bot-like
3. Install the [Cookie-Editor](https://cookie-editor.com) browser extension
4. While logged into the scraper account on x.com, open Cookie-Editor → **Export** → copy the JSON
5. Add the account to your `.env` using the numbered format below

### Configuring scraper accounts in `.env`

```bash
TWITTER_ACCOUNT_1_USERNAME=your_scraper_username
TWITTER_ACCOUNT_1_EMAIL=your_scraper_email@gmail.com
TWITTER_ACCOUNT_1_PASSWORD=your_scraper_password
TWITTER_ACCOUNT_1_COOKIES=<paste Cookie-Editor JSON here, all on one line>

# Add more accounts by incrementing the number:
TWITTER_ACCOUNT_2_USERNAME=second_scraper_username
TWITTER_ACCOUNT_2_EMAIL=...
TWITTER_ACCOUNT_2_PASSWORD=...
TWITTER_ACCOUNT_2_COOKIES=...
```

Multiple accounts are recommended — the tracker rotates between them to avoid rate limits. The default deployment uses `reinaldosa35242` and `cookiemons84953` as scraper accounts; forks should substitute their own.

### Refreshing expired cookies

Cookies going stale shows up in the logs as `No active accounts` or `AttributeError: 'NoneType' object has no attribute 'id'`. To fix:

1. Log back into the scraper account in Chrome
2. Export fresh cookies via Cookie-Editor
3. SSH into the VM:
   ```bash
   gcloud compute ssh twitter-tracker-vm --zone=us-central1-a --tunnel-through-iap --project=twitter-tracker-2025
   ```
4. Edit the `.env` and replace the stale `TWITTER_ACCOUNT_N_COOKIES` value
5. Restart the tracker:
   ```bash
   sudo systemctl restart tracker && sudo journalctl -u tracker -f
   ```

## Module responsibilities

- `main.py` — entry point; scheduling loop
- `tracker.py` — core diffing logic; catches and logs exceptions per account
- `twitter_client.py` — twscrape wrapper; cookie-based auth, multi-account pool
- `storage.py` — GCS read/write for all state
- `api.py` — FastAPI backend; reads/writes GCS via storage.py
- `telegram_notifier.py` — single `send_message()` using raw `requests`
- `signals.py` — convergence and velocity signal detection
- `config.py` — loads `.env` and exposes typed constants
