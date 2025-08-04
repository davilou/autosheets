#!/bin/bash

set -e

echo "🚀 Iniciando deploy do AutoSheets em produção..."

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
    docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U postgres autosheets > "backups/backup_$DATE.sql"
    echo "✅ Backup criado: backups/backup_$DATE.sql"
else
    echo "ℹ️  Banco de dados não está rodando, pulando backup."
fi

# Parar serviços existentes
echo "🛑 Parando serviços existentes..."
docker compose -f docker-compose.prod.yml down

# Limpar imagens antigas
echo "🧹 Limpando imagens antigas..."
docker image prune -f

# Construir e iniciar serviços
echo "🔨 Construindo e iniciando serviços..."
docker compose -f docker-compose.prod.yml up -d --build

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
