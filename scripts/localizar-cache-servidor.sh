#!/bin/bash

# Script para localizar e verificar o cache de apostas no servidor
# Criado para diagnosticar onde o cache está sendo salvo

echo "🔍 Localizando cache de apostas no servidor..."
echo "==========================================="

# 1. Verificar diretório atual
echo "📂 Diretório atual: $(pwd)"
echo ""

# 2. Procurar arquivos de cache
echo "🔎 Procurando arquivos .bet-cache.json..."
find / -name ".bet-cache.json" -type f 2>/dev/null | head -10
echo ""

# 3. Procurar no diretório do container
echo "🐳 Verificando dentro do container autosheets_app..."
docker exec autosheets_app find / -name ".bet-cache.json" -type f 2>/dev/null | head -10
echo ""

# 4. Verificar diretório de trabalho do container
echo "📁 Diretório de trabalho do container:"
docker exec autosheets_app pwd
echo ""

# 5. Listar arquivos no diretório de trabalho do container
echo "📋 Arquivos no diretório de trabalho do container:"
docker exec autosheets_app ls -la
echo ""

# 6. Verificar se existe cache no container
echo "💾 Verificando cache no container:"
if docker exec autosheets_app test -f ".bet-cache.json"; then
    echo "✅ Cache encontrado no container!"
    echo "📊 Conteúdo do cache:"
    docker exec autosheets_app cat .bet-cache.json | jq . 2>/dev/null || docker exec autosheets_app cat .bet-cache.json
else
    echo "❌ Cache não encontrado no container"
fi
echo ""

# 7. Verificar logs recentes para confirmar salvamento
echo "📝 Logs recentes de salvamento no cache:"
docker compose -f docker-compose.prod.yml logs --tail=20 autosheets_app | grep -E "(💾|cache|salva)"
echo ""

# 8. Verificar variáveis de ambiente relacionadas ao cache
echo "🔧 Variáveis de ambiente do container:"
docker exec autosheets_app env | grep -i cache || echo "Nenhuma variável de cache encontrada"
echo ""

# 9. Verificar se o Redis está sendo usado para cache
echo "🔴 Verificando Redis:"
if docker exec autosheets_app redis-cli ping 2>/dev/null; then
    echo "✅ Redis está respondendo"
    echo "🔑 Chaves no Redis:"
    docker exec autosheets_app redis-cli keys "*bet*" 2>/dev/null || echo "Nenhuma chave de aposta encontrada"
else
    echo "❌ Redis não está acessível"
fi
echo ""

echo "🏁 Diagnóstico de localização do cache concluído!"
echo "==========================================="
echo ""
echo "📋 Próximos passos:"
echo "1. Se o cache foi encontrado no container, use os comandos com 'docker exec'"
echo "2. Se o cache está no Redis, use comandos redis-cli"
echo "3. Se não foi encontrado, verifique se o monitor está realmente salvando"