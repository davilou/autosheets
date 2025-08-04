#!/bin/bash

# Script para configurar o banco de dados
set -e

echo "🚀 Configurando banco de dados..."

# Verificar se o .env.local existe
if [ ! -f ".env.local" ]; then
    echo "❌ Arquivo .env.local não encontrado!"
    exit 1
fi

# Carregar variáveis de ambiente
source .env.local

# Instalar dependências do Prisma se necessário
echo "📦 Instalando dependências..."
npm install prisma @prisma/client ioredis
npm install -D @types/ioredis

# Gerar cliente Prisma
echo "🔧 Gerando cliente Prisma..."
npx prisma generate

# Fazer push do schema para o banco
echo "📊 Sincronizando schema com o banco..."
npx prisma db push

# Verificar se tudo está funcionando
echo "🔍 Testando conexões..."
node -e "
  const { testDatabaseConnection } = require('./src/lib/db.ts');
  const { testRedisConnection } = require('./src/lib/redis.ts');
  
  Promise.all([
    testDatabaseConnection(),
    testRedisConnection()
  ]).then(([db, redis]) => {
    console.log('Database:', db ? '✅' : '❌');
    console.log('Redis:', redis ? '✅' : '❌');
    process.exit(db && redis ? 0 : 1);
  }).catch(console.error);
"

echo "✅ Setup do banco concluído!"
echo "💡 Para visualizar o banco: npx prisma studio"
echo "🔗 Health check: http://localhost:3000/api/health"