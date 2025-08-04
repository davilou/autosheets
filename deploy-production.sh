#!/bin/bash

set -e

echo "🚀 Iniciando deploy do AutoSheets em produção..."

<<<<<<< HEAD
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

# Create directories
mkdir -p "$BACKUP_DIR" "$SSL_DIR"

log "🚀 Starting production deployment of $APP_NAME"

# Check if required files exist
if [[ ! -f ".env.production" ]]; then
    error ".env.production file not found!"
    info "Please create .env.production file first"
    exit 1
fi

# Load environment variables
source .env.production

# Git operations
log "📥 Updating code from repository..."
git fetch origin
git reset --hard origin/main

# Remove Dockerfile from .dockerignore if present
if grep -q "^Dockerfile$" .dockerignore; then
    sed -i '/^Dockerfile$/d' .dockerignore
    log "✅ Removed Dockerfile from .dockerignore"
fi

# Backup database if exists
if docker compose -f docker-compose.prod.yml ps postgres | grep -q "Up"; then
    log "💾 Creating database backup..."
    BACKUP_FILE="$BACKUP_DIR/postgres_backup_$(date +%Y%m%d_%H%M%S).sql"
    docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U autosheets autosheets > "$BACKUP_FILE" 2>/dev/null || {
        warn "Database backup failed or database not accessible"
    }
fi

# Stop services
log "🛑 Stopping services..."
docker compose -f docker-compose.prod.yml down

# Clean up old images
log "🧹 Cleaning up old images..."
docker image prune -f

# Build and start services
log "🔨 Building and starting services..."
docker compose -f docker-compose.prod.yml up -d --build
=======
# Verificar se .env.production existe
if [ ! -f ".env.production" ]; then
    echo "❌ Arquivo .env.production não encontrado!"
    echo "Por favor, crie o arquivo .env.production com as variáveis necessárias."
    exit 1
fi

# Criar backup do banco de dados se existir
echo "📦 Criando backup do banco de dados..."
mkdir -p backups
DATE=$(date +"%Y%m%d_%H%M%S")
if docker compose -f docker-compose.prod.yml ps postgres | grep -q "Up"; then
    docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U autosheets autosheets > "backups/backup_${DATE}.sql" || echo "⚠️  Backup falhou, continuando..."
fi

# Parar containers existentes
echo "🛑 Parando containers existentes..."
docker compose -f docker-compose.prod.yml down || true

# Limpar containers e imagens antigas
echo "🧹 Limpando containers e imagens antigas..."
docker system prune -f
>>>>>>> 20511edaadf61f23176dcbf7cc0660b8b06d113e

# Construir e subir os serviços
echo "🔨 Construindo e iniciando serviços..."
docker compose -f docker-compose.prod.yml up --build -d

<<<<<<< HEAD
# Check service health
log "🔍 Checking service health..."
for service in postgres redis autosheets; do
    for i in {1..10}; do
        if docker compose -f docker-compose.prod.yml ps $service | grep -q "healthy"; then
            log "✅ $service is healthy"
            break
        else
            warn "$service health check attempt $i failed, retrying in 10 seconds..."
            sleep 10
        fi
        
        if [[ $i -eq 10 ]]; then
            error "$service failed health check after 10 attempts"
            docker compose -f docker-compose.prod.yml logs $service
            exit 1
        fi
    done
done

# Run database migrations
log "🗄️ Running database migrations..."
docker compose -f docker-compose.prod.yml exec -T autosheets npx prisma generate
docker compose -f docker-compose.prod.yml exec -T autosheets npx prisma db push

# Setup SSL with Let's Encrypt (if not exists)
if [[ ! -f "$SSL_DIR/fullchain.pem" ]]; then
    log "🔒 Setting up SSL certificate..."
    apt-get update && apt-get install -y certbot
    
    # Stop nginx temporarily
    docker compose -f docker-compose.prod.yml stop nginx
    
    certbot certonly --standalone \
        --email admin@loudigital.shop \
        --agree-tos \
        --no-eff-email \
        -d $DOMAIN
    
    # Copy certificates
    cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $SSL_DIR/
    cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $SSL_DIR/
    
    # Start nginx again
    docker compose -f docker-compose.prod.yml start nginx
else
    log "✅ SSL certificate already exists"
fi

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
        exit 1
    fi
done

# Show running containers
log "📊 Current running containers:"
docker compose -f docker-compose.prod.yml ps

# Show application info
log "🎉 Deployment completed successfully!"
log "🌐 Application URL: https://$DOMAIN"
log "📊 Health Check: https://$DOMAIN/api/health"
log "📝 Logs: docker compose -f docker-compose.prod.yml logs -f"

log "🚀 AutoSheets is now running in production!"
=======
# Aguardar serviços ficarem prontos
echo "⏳ Aguardando serviços ficarem prontos..."
sleep 30

# Executar migrations
echo "🗄️  Executando migrations do banco de dados..."
docker compose -f docker-compose.prod.yml exec -T autosheets npx prisma generate
docker compose -f docker-compose.prod.yml exec -T autosheets npx prisma db push

# Verificar status dos serviços
echo "✅ Verificando status dos serviços..."
docker compose -f docker-compose.prod.yml ps

# Testar conectividade
echo "🔍 Testando conectividade..."
sleep 10
if curl -f http://localhost/api/health > /dev/null 2>&1; then
    echo "✅ Aplicação está respondendo!"
else
    echo "⚠️  Aplicação pode não estar respondendo ainda. Verifique os logs."
fi

echo "🎉 Deploy concluído!"
echo "📊 Para monitorar os logs: docker compose -f docker-compose.prod.yml logs -f"
echo "📈 Para verificar status: docker compose -f docker-compose.prod.yml ps"
>>>>>>> 20511edaadf61f23176dcbf7cc0660b8b06d113e
