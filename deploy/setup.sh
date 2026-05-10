#!/usr/bin/env bash
# Run this once on a fresh server to install deps and wire up services.
# Edit YOUR_USER and YOUR_DOMAIN before running.
set -e

REPO_DIR=/home/YOUR_USER/twitter-tracker

# --- Python deps ---
cd "$REPO_DIR"
pip3 install -r requirements.txt

# --- Web build ---
cd "$REPO_DIR/web"
# Copy and fill in your env before building
cp env.local.example .env.local
# Edit .env.local: set NEXT_PUBLIC_API_URL=https://YOUR_DOMAIN/api  (or :8000)
echo "Edit web/.env.local, then press Enter to continue..."
read -r
npm ci
npm run build

# --- Transfer secrets (run locally, not on server) ---
# scp .env YOUR_USER@YOUR_SERVER:$REPO_DIR/.env
# scp -r data/ YOUR_USER@YOUR_SERVER:$REPO_DIR/data/

# --- Systemd ---
cd "$REPO_DIR/deploy"
sudo cp tracker.service api.service web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable tracker api web
sudo systemctl start tracker api web

echo "Done. Check status with: sudo systemctl status tracker api web"
