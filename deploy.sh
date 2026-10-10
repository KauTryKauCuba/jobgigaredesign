#!/usr/bin/env sh
# One-command deploy for the VPS:
#
#   cd ~/jobgigaredesign && ./deploy.sh
#
# Pulls the latest main, rebuilds and restarts the app container (database
# migrations run automatically when the container starts — see the
# Dockerfile's CMD), then checks the site actually answers.
set -e
cd "$(dirname "$0")"

echo "==> Pulling latest code"
# npm on the server sometimes rewrites package-lock.json, which blocks
# `git pull`. The server never has real changes to it, so discard them.
git checkout -- package-lock.json 2>/dev/null || true
git pull origin main
echo "    now at: $(git log --oneline -1)"

echo "==> Building and restarting"
# The VPS's outbound network is occasionally flaky (DNS timeouts pulling the
# base image), so retry the build a few times before giving up.
attempt=1
until docker compose up -d --build; do
  if [ "$attempt" -ge 3 ]; then
    echo "!! Build failed 3 times — likely a network problem on the VPS. Try again in a minute."
    exit 1
  fi
  attempt=$((attempt + 1))
  echo "    build failed, retrying in 15s (attempt $attempt of 3)..."
  sleep 15
done

echo "==> Waiting for the app to come up (migrations run first)"
i=0
while [ "$i" -lt 30 ]; do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4100/employer || true)
  if [ "$code" = "200" ]; then
    echo "==> Deployed. Site is up."
    exit 0
  fi
  i=$((i + 1))
  sleep 2
done

echo "!! The app didn't respond within 60s. Recent logs:"
docker compose logs --tail=40 app
exit 1
