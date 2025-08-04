#!/bin/bash

# AutoSheets Production Deploy Script
# Usage: ./deploy-production.sh

set -e

# Configuration
APP_NAME="autosheets"
DOMAIN="autosheets.loudigital.shop"
BACKUP_DIR="./backups"
LOG_FILE="/var/log/autosheets-deploy.log"
SSL_DIR="./ssl"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1" | tee -a "$LOG_FILE"
}

# Send Telegram notification
send_telegram() {
    local message="$1"
    if [[ -n "$TELEGRAM_BOT_TOKEN" && -n "$DEPLOY_CHAT_ID" ]]; then
        curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
            -d chat_id="$DEPLOY_CHAT_ID" \
            -d text="🚀 AutoSheets Deploy: $message" \
            -d parse_mode="Markdown" > /dev/null
    fi
}

# Generate secure passwords
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
}

# Create directories
mkdir -p "$BACKUP_DIR" "$SSL_DIR"

log "🚀 Starting production deployment of $APP_NAME"
send_telegram "Deployment started for $DOMAIN"

# Check if required files exist
if [[ ! -f ".env.production" ]]; then
    error ".env.production file not found!"
    info "Creating .env.production template..."
    
    # Generate secure passwords
    POSTGRES_PASS=$(generate_password)
    REDIS_PASS=$(generate_password)
    JWT_SECRET=$(generate_password)
    NEXTAUTH_SECRET=$(generate_password)
    
    cat > .env.production << EOF
# Generated on $(date)
NODE_ENV=production

# NextAuth
NEXTAUTH_URL=https://$DOMAIN
NEXTAUTH_SECRET=$NEXTAUTH_SECRET

# Database
DATABASE_URL=postgresql://autosheets:$POSTGRES_PASS@postgres:5432/autosheets
POSTGRES_PASSWORD=$POSTGRES_PASS

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=$REDIS_PASS
REDIS_URL=redis://:$REDIS_PASS@redis:6379
REDIS_DB=0

# JWT
JWT_SECRET=$JWT_SECRET

# TODO: Configure these variables:
# TELEGRAM_BOT_TOKEN=
# TELEGRAM_WEBHOOK_URL=https://$DOMAIN/api/telegram/webhook
# TELEGRAM_API_ID=
# TELEGRAM_API_HASH=
# GOOGLE_SHEETS_ID=
# GOOGLE_CLIENT_EMAIL=
# GOOGLE_PRIVATE_KEY=
# GEMINI_API_KEY=
EOF
    
    warn "Please edit .env.production and configure the remaining variables!"
    info "Generated passwords saved in .env.production"
    exit 1
fi

# Load environment variables
source .env.production

# Git operations
log "📥 Updating code from repository..."
git fetch origin
git reset --hard origin/main

# Backup database if exists
if docker-compose -f docker-compose.prod.yml ps postgres | grep -q "Up"; then
    log "💾 Creating database backup..."
    BACKUP_FILE="$BACKUP_DIR/postgres_backup_$(date +%Y%m%d_%H%M%S).sql"
    docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U autosheets autosheets > "$BACKUP_FILE" 2>/dev/null || {
        warn "Database backup failed or database not accessible"
    }
fi

# Stop services
log "🛑 Stopping services..."
docker-compose -f docker-compose.prod.yml down

# Build and start services
log "🔨 Building and starting services..."
docker-compose -f docker-compose.prod.yml up -d --build

# Wait for services to be healthy
log "⏳ Waiting for services to be healthy..."
sleep 60

# Check service health
log "🔍 Checking service health..."
for service in postgres redis autosheets; do
    for i in {1..10}; do
        if docker-compose -f docker-compose.prod.yml ps $service | grep -q "healthy"; then
            log "✅ $service is healthy"
            break
        else
            warn "$service health check attempt $i failed, retrying in 10 seconds..."
            sleep 10
        fi
        
        if [[ $i -eq 10 ]]; then
            error "$service failed health check after 10 attempts"
            docker-compose -f docker-compose.prod.yml logs $service
            send_telegram "❌ Deployment failed - $service health check timeout"
            exit 1
        fi
    done
done

# Run database migrations
log "🗄️ Running database migrations..."
docker-compose -f docker-compose.prod.yml exec -T autosheets npx prisma generate
docker-compose -f docker-compose.prod.yml exec -T autosheets npx prisma db push

# Setup SSL with Let's Encrypt
log "🔒 Setting up SSL certificate..."
if [[ ! -f "$SSL_DIR/fullchain.pem" ]]; then
    info "Installing certbot..."
    apt-get update && apt-get install -y certbot
    
    info "Obtaining SSL certificate..."
    certbot certonly --standalone \
        --email admin@loudigital.shop \
        --agree-tos \
        --no-eff-email \
        -d $DOMAIN
    
    # Copy certificates
    cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $SSL_DIR/
    cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $SSL_DIR/
    
    # Set up auto-renewal
    (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet --deploy-hook 'cp /etc/letsencrypt/live/$DOMAIN/*.pem $SSL_DIR/ && docker-compose -f $(pwd)/docker-compose.prod.yml restart nginx'") | crontab -
else
    info "SSL certificate already exists"
fi

# Restart nginx to load SSL
log "🔄 Restarting nginx with SSL..."
docker-compose -f docker-compose.prod.yml restart nginx

# Final health check
log "🏥 Performing final health check..."
HEALTH_CHECK_URL="https://$DOMAIN/api/health"
for i in {1..10}; do
    if curl -f -k "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
        log "✅ Application is running successfully!"
        break
    else
        warn "Final health check attempt $i failed, retrying in 10 seconds..."
        sleep 10
    fi
    
    if [[ $i -eq 10 ]]; then
        error "Final health check failed after 10 attempts"
        send_telegram "❌ Deployment failed - Final health check timeout"
        exit 1
    fi
done

# Cleanup old backups (keep last 7 days)
log "🧹 Cleaning up old backups..."
find "$BACKUP_DIR" -name "postgres_backup_*.sql" -mtime +7 -delete

# Show running containers
log "📊 Current running containers:"
docker-compose -f docker-compose.prod.yml ps

# Show application info
log "🎉 Deployment completed successfully!"
log "🌐 Application URL: https://$DOMAIN"
log "📊 Health Check: https://$DOMAIN/api/health"
log "📝 Logs: docker-compose -f docker-compose.prod.yml logs -f"

send_telegram "✅ Deployment completed successfully! Application is running at https://$DOMAIN"

log "🚀 AutoSheets is now running in production!"