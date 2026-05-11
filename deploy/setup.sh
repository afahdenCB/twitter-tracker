#!/usr/bin/env bash
# Run once on the tracker VM after cloning the repo.
# The API runs on Cloud Run; this VM only runs the tracker (main.py).
set -e

REPO_DIR=/home/YOUR_USER/twitter-tracker

cd "$REPO_DIR"
pip3 install -r requirements.txt

# Copy and fill in secrets before enabling services.
# scp .env YOUR_USER@YOUR_VM_INTERNAL_IP:$REPO_DIR/.env
# Required vars in .env: GCS_BUCKET, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
#   TWITTER_ACCOUNT_1_USERNAME, TWITTER_ACCOUNT_1_COOKIES, etc.

cd "$REPO_DIR/deploy"
sudo cp tracker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable tracker
sudo systemctl start tracker

echo "Done. Check status with: sudo systemctl status tracker"
