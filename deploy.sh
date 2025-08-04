#!/bin/bash

# AutoSheets Deploy Script
# Usage: ./deploy.sh

set -e

# Configuration
APP_NAME="autosheets"
BACKUP_DIR="./backups"
LOG_FILE="/var/log/autosheets-deploy.log"
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN}"
TELEGRAM_CHAT_ID="${DEPLOY_CHAT_ID}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

# Send Telegram notification
send_telegram() {
    local message="$1"
    if [[ -n "$TELEGRAM_BOT_TOKEN" && -n "$TELEGRAM_CHAT_ID" ]]; then
        curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
            -d chat_id="$TELEGRAM_CHAT_ID" \
            -d text="🚀 AutoSheets Deploy: $message" \
            -d parse_mode="Markdown" > /dev/null
    fi
}

# Create backup directory
mkdir -p "$BACKUP_DIR"

log "Starting deployment of $APP_NAME"
send_telegram "Deployment started"

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    error "docker-compose not found. Please install Docker Compose."
    exit 1
fi

# Check if .env.production exists
if [[ ! -f ".env.production" ]]; then
    error ".env.production file not found. Please create it based on .env.production.example"
    exit 1
fi

# Backup database
log "Creating database backup..."
BACKUP_FILE="$BACKUP_DIR/postgres_backup_$(date +%Y%m%d_%H%M%S).sql"
docker-compose exec -T postgres pg_dump -U autosheets autosheets > "$BACKUP_FILE" 2>/dev/null || {
    warn "Database backup failed or database not running"
}

# Git operations
log "Updating code from repository..."
git fetch origin
git reset --hard origin/main

# Stop services
log "Stopping services..."
docker-compose down

# Build and start services
log "Building and starting services..."
docker-compose up -d --build

# Wait for services to be healthy
log "Waiting for services to be healthy..."
sleep 30

# Health check
log "Performing health check..."
HEALTH_CHECK_URL="http://localhost/api/health"
for i in {1..10}; do
    if curl -f "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
        log "Health check passed!"
        break
    else
        warn "Health check attempt $i failed, retrying in 10 seconds..."
        sleep 10
    fi
    
    if [[ $i -eq 10 ]]; then
        error "Health check failed after 10 attempts"
        send_telegram "❌ Deployment failed - Health check timeout"
        exit 1
    fi
done

# Cleanup old backups (keep last 7 days)
log "Cleaning up old backups..."
find "$BACKUP_DIR" -name "postgres_backup_*.sql" -mtime +7 -delete

# Show running containers
log "Current running containers:"
docker-compose ps

log "Deployment completed successfully!"
send_telegram "✅ Deployment completed successfully"

# Show logs for troubleshooting
log "Recent application logs:"
docker-compose logs --tail=20 autosheets