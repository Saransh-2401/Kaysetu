#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# KaySetu — One-command production deployment.
# Run ON THE VPS from the project root:   chmod +x deploy.sh && ./deploy.sh
#
# Prerequisites:
#   - Docker + Docker Compose V2 installed
#   - Caddy already running on the host (managing SSL)
#   - DNS A-records for api/ops/app.kaysetu.kayease.com → this VPS
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

say()  { echo -e "\n\033[1;36m==> $*\033[0m"; }
warn() { echo -e "\033[1;33m!!  $*\033[0m"; }
ok()   { echo -e "\033[1;32m✓   $*\033[0m"; }

# ──────────────────────────────────────────── Pre-flight checks
if ! command -v docker &>/dev/null; then
  echo "ERROR: Docker is not installed. Install it first:"
  echo "  curl -fsSL https://get.docker.com | sh"
  exit 1
fi

if ! docker compose version &>/dev/null; then
  echo "ERROR: Docker Compose V2 is required (bundled with modern Docker)."
  exit 1
fi

if [ ! -f .env.production ]; then
  echo "ERROR: .env.production not found."
  echo "  Fill in your secrets before deploying."
  exit 1
fi

# Warn if secrets haven't been changed
if grep -q "CHANGE-ME" .env.production; then
  warn "PG_PASSWORD in .env.production still has a placeholder!"
  warn "Change it NOW before proceeding. Aborting."
  exit 1
fi

# ──────────────────────────────────────────── Build & Start
say "Building and starting the production stack..."
say "(First run pulls images + compiles Next.js — this will take a few minutes)"
$COMPOSE up -d --build

# ──────────────────────────────────────────── Wait for API health
say "Waiting for the API to come up..."
RETRIES=60
until curl -sf http://127.0.0.1:3001/api/health > /dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [ $RETRIES -le 0 ]; then
    warn "API health check timed out. Recent backend logs:"
    $COMPOSE logs --tail=50 backend
    exit 1
  fi
  printf "."
  sleep 5
done
echo ""
ok "API is healthy."

# ──────────────────────────────────────────── Bootstrap
say "Seeding SuperAdmin and demo tenants..."
$COMPOSE exec -T backend python manage.py bootstrap \
  || warn "Bootstrap reported an error (see above). The stack is still running."

# ──────────────────────────────────────────── Caddy config reminder
echo ""
say "Docker stack is up. Now add KaySetu to your host Caddy:"
echo ""
echo "    1. Append the contents of ./Caddyfile to your VPS Caddyfile:"
echo "       cat ./Caddyfile >> /etc/caddy/Caddyfile"
echo ""
echo "    2. Reload Caddy:"
echo "       sudo systemctl reload caddy"
echo ""

# ──────────────────────────────────────────── Done!
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
say "Deployment complete! Your services will be live at:"
echo ""
echo "    SuperAdmin console   https://ops.kaysetu.kayease.com/ops/login"
echo "    Tenant portal        https://app.kaysetu.kayease.com"
echo "    API                  https://api.kaysetu.kayease.com/api"
echo ""
echo "    View logs:       $COMPOSE logs -f"
echo "    Stop stack:      $COMPOSE down"
echo "    Rebuild:         $COMPOSE up -d --build"
echo "    Reset (wipe DB): $COMPOSE down -v && $COMPOSE up -d --build"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
