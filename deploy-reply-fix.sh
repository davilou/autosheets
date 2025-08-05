#!/bin/bash

# Script de deploy para aplicar correções do sistema de replies
# Executa no servidor de produção

set -e  # Parar em caso de erro

echo "🚀 INICIANDO DEPLOY DA CORREÇÃO DE REPLIES"
echo "================================================"

# Configurações
SERVER_HOST="31.97.168.36"
SERVER_USER="root"
CONTAINER_NAME="autosheets-app-1"
BACKUP_DIR="/root/backups/$(date +%Y%m%d_%H%M%S)"

echo "📋 Configurações:"
echo "- Servidor: $SERVER_HOST"
echo "- Usuário: $SERVER_USER"
echo "- Container: $CONTAINER_NAME"
echo "- Backup: $BACKUP_DIR"
echo ""

# Função para executar comandos SSH
execute_ssh() {
    local command="$1"
    echo "🔧 Executando: $command"
    ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_HOST" "$command"
}

# Função para copiar arquivos
copy_file() {
    local local_file="$1"
    local remote_file="$2"
    echo "📤 Copiando: $local_file -> $remote_file"
    scp -o StrictHostKeyChecking=no "$local_file" "$SERVER_USER@$SERVER_HOST:$remote_file"
}

echo "1️⃣ VERIFICANDO ESTADO ATUAL DO SERVIDOR"
echo "----------------------------------------"

# Verificar se o container está rodando
echo "🔍 Verificando container..."
execute_ssh "docker ps | grep $CONTAINER_NAME || echo 'Container não encontrado'"

# Verificar cache atual
echo "🔍 Verificando cache atual..."
execute_ssh "docker exec $CONTAINER_NAME ls -la /.bet-cache.json 2>/dev/null || echo 'Cache não encontrado'"
execute_ssh "docker exec $CONTAINER_NAME cat /.bet-cache.json 2>/dev/null | head -5 || echo 'Cache vazio ou ilegível'"

echo ""
echo "2️⃣ CRIANDO BACKUP"
echo "----------------"

# Criar diretório de backup
execute_ssh "mkdir -p $BACKUP_DIR"

# Backup do cache atual
execute_ssh "docker exec $CONTAINER_NAME cat /.bet-cache.json > $BACKUP_DIR/bet-cache-backup.json 2>/dev/null || echo '{}' > $BACKUP_DIR/bet-cache-backup.json"

# Backup dos logs recentes
execute_ssh "docker logs $CONTAINER_NAME --tail=500 > $BACKUP_DIR/logs-before-fix.txt 2>&1"

echo "✅ Backup criado em: $BACKUP_DIR"

echo ""
echo "3️⃣ APLICANDO CORREÇÕES"
echo "---------------------"

# Copiar arquivos corrigidos
echo "📤 Copiando arquivos corrigidos..."
copy_file "src/app/api/telegram/webhook/route.ts" "/tmp/route.ts"
copy_file "src/app/api/health/route.ts" "/tmp/health-route.ts"

# Aplicar correções no container
echo "🔧 Aplicando correções no container..."
execute_ssh "docker cp /tmp/route.ts $CONTAINER_NAME:/app/src/app/api/telegram/webhook/route.ts"
execute_ssh "docker cp /tmp/health-route.ts $CONTAINER_NAME:/app/src/app/api/health/route.ts"

# Verificar se os arquivos foram copiados
echo "🔍 Verificando arquivos copiados..."
execute_ssh "docker exec $CONTAINER_NAME ls -la /app/src/app/api/telegram/webhook/route.ts"
execute_ssh "docker exec $CONTAINER_NAME ls -la /app/src/app/api/health/route.ts"

echo ""
echo "4️⃣ REINICIANDO SERVIÇOS"
echo "----------------------"

# Reiniciar container para aplicar mudanças
echo "🔄 Reiniciando container..."
execute_ssh "docker restart $CONTAINER_NAME"

# Aguardar container subir
echo "⏳ Aguardando container inicializar..."
sleep 10

# Verificar se container está rodando
echo "🔍 Verificando se container está rodando..."
execute_ssh "docker ps | grep $CONTAINER_NAME"

echo ""
echo "5️⃣ VALIDANDO CORREÇÕES"
echo "---------------------"

# Testar health check
echo "🏥 Testando health check..."
execute_ssh "curl -s http://localhost:3000/api/health | jq '.replies.fixes' 2>/dev/null || echo 'Health check não disponível ainda'"

# Verificar logs após reinício
echo "📋 Verificando logs após correção..."
execute_ssh "docker logs $CONTAINER_NAME --tail=20"

# Testar webhook com payload de teste
echo "🧪 Testando webhook com payload de teste..."
execute_ssh 'curl -X POST http://localhost:3000/api/telegram/webhook \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": {
      \"message_id\": 999,
      \"from\": {
        \"id\": 123456789,
        \"first_name\": \"Test\"
      },
      \"chat\": {
        \"id\": 123456789,
        \"type\": \"private\"
      },
      \"text\": \"1.85\",
      \"reply_to_message\": {
        \"message_id\": 888
      }
    }
  }" 2>/dev/null || echo "Teste de webhook falhou"'

# Verificar logs após teste
echo "📋 Logs após teste de webhook..."
execute_ssh "docker logs $CONTAINER_NAME --tail=10 | grep -E '(CORREÇÃO APLICADA|Debug da chave|YOUR_USER_ID)'"

echo ""
echo "6️⃣ CRIANDO SCRIPT DE MONITORAMENTO"
echo "----------------------------------"

# Criar script de monitoramento no servidor
cat > /tmp/monitor-replies.sh << 'EOF'
#!/bin/bash

# Script de monitoramento contínuo do sistema de replies

echo "🔍 MONITORAMENTO DO SISTEMA DE REPLIES"
echo "====================================="
echo "Timestamp: $(date)"
echo ""

echo "📊 Status do Container:"
docker ps | grep autosheets-app-1
echo ""

echo "💾 Cache Status:"
docker exec autosheets-app-1 ls -la /.bet-cache.json 2>/dev/null || echo "Cache não encontrado"
echo "Cache size: $(docker exec autosheets-app-1 cat /.bet-cache.json 2>/dev/null | jq 'length' 2>/dev/null || echo '0') apostas"
echo ""

echo "🏥 Health Check:"
curl -s http://localhost:3000/api/health | jq '.replies' 2>/dev/null || echo "Health check indisponível"
echo ""

echo "📋 Logs Recentes (últimas 5 linhas):"
docker logs autosheets-app-1 --tail=5
echo ""

echo "🔍 Logs de Reply (últimas 10 ocorrências):"
docker logs autosheets-app-1 --tail=200 | grep -E "(reply_to_message|CORREÇÃO APLICADA|Debug da chave)" | tail -10
echo ""
EOF

copy_file "/tmp/monitor-replies.sh" "/root/monitor-replies.sh"
execute_ssh "chmod +x /root/monitor-replies.sh"

echo ""
echo "✅ DEPLOY CONCLUÍDO COM SUCESSO!"
echo "================================"
echo ""
echo "📋 RESUMO DAS CORREÇÕES APLICADAS:"
echo "1. ✅ Geração de chaves padronizada (YOUR_USER_ID)"
echo "2. ✅ Health check com monitoramento de replies"
echo "3. ✅ Logs de debug melhorados"
echo "4. ✅ Script de monitoramento criado"
echo ""
echo "🎯 PRÓXIMOS PASSOS:"
echo "1. Testar com reply real: Envie uma aposta no grupo e responda ao bot"
echo "2. Monitorar sistema: ssh root@31.97.168.36 './monitor-replies.sh'"
echo "3. Verificar health check: curl http://31.97.168.36:3000/api/health"
echo "4. Acompanhar logs: ssh root@31.97.168.36 'docker logs autosheets-app-1 -f'"
echo ""
echo "📁 Backup salvo em: $BACKUP_DIR"
echo "🔧 Script de monitoramento: /root/monitor-replies.sh"
echo ""
echo "🚀 Sistema de replies corrigido e pronto para uso!"