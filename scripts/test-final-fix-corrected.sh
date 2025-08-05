#!/bin/bash

# Script final CORRIGIDO para testar se a correção do TypeScript funcionou
# Usa docker-compose.prod.yml e reinicia completamente o sistema

echo "🔧 TESTE FINAL DA CORREÇÃO DO TYPESCRIPT (VERSÃO CORRIGIDA)"
echo "============================================================"
echo ""

# 1. Parar e remover todos os containers
echo "🛑 PARANDO E REMOVENDO CONTAINERS:"
echo "----------------------------------"
docker compose -f docker-compose.prod.yml down
echo "✅ Containers removidos"
echo ""

# 2. Rebuild completo
echo "🔨 REBUILD COMPLETO:"
echo "-------------------"
docker compose -f docker-compose.prod.yml build --no-cache autosheets
echo "✅ Build concluído"
echo ""

# 3. Iniciar todos os serviços
echo "🚀 INICIANDO SERVIÇOS:"
echo "----------------------"
docker compose -f docker-compose.prod.yml up -d
echo "Aguardando inicialização..."
sleep 30
echo ""

# 4. Verificar status de todos os containers
echo "📊 VERIFICANDO STATUS DOS CONTAINERS:"
echo "------------------------------------"
docker compose -f docker-compose.prod.yml ps
echo ""

# 5. Verificar se o servidor está rodando
echo "🌐 VERIFICANDO SERVIDOR:"
echo "-----------------------"
echo "Processos Node.js:"
docker exec autosheets_app ps aux | grep node | grep -v grep
echo ""
echo "Porta 3000:"
docker exec autosheets_app netstat -tlnp | grep :3000
echo ""

# 6. Testar compilação TypeScript
echo "🔧 TESTANDO COMPILAÇÃO TYPESCRIPT:"
echo "---------------------------------"
echo "Testando apenas o arquivo do webhook:"
docker exec autosheets_app npx tsc --noEmit --skipLibCheck src/app/api/telegram/webhook/route.ts
if [ $? -eq 0 ]; then
    echo "✅ Compilação TypeScript bem-sucedida!"
    TYPESCRIPT_OK=true
else
    echo "❌ Ainda há erros de TypeScript"
    TYPESCRIPT_OK=false
fi
echo ""

# 7. Verificar se o Next.js está compilando corretamente
echo "⚡ VERIFICANDO COMPILAÇÃO DO NEXT.JS:"
echo "------------------------------------"
echo "Logs de build do Next.js:"
docker logs autosheets_app --tail 20 | grep -E "(Ready|Error|warn|Compiled)"
echo ""

# 8. Criar uma aposta de teste no cache
echo "💾 CRIANDO APOSTA DE TESTE:"
echo "---------------------------"
TEST_USER_ID="987654321"
TEST_MESSAGE_ID="456"
TEST_KEY="${TEST_USER_ID}_${TEST_MESSAGE_ID}"

# Criar aposta de teste
TEST_BET='{
  "'$TEST_KEY'": {
    "jogo": "Teste vs Correção",
    "placar": "1x0",
    "mercado": "Goal Line",
    "linha_da_aposta": "GL +0.5",
    "odd_tipster": "1.85",
    "chatId": '$TEST_USER_ID',
    "userId": '$TEST_USER_ID',
    "username": "testuser",
    "timestamp": "'$(date -Iseconds)'",
    "pegou": null,
    "odd_real": null
  }
}'

echo "$TEST_BET" | docker exec -i autosheets_app tee .bet-cache.json > /dev/null
echo "✅ Aposta de teste criada com chave: $TEST_KEY"
echo ""

# 9. Testar webhook com reply através do nginx
echo "🧪 TESTANDO WEBHOOK COM REPLY (VIA NGINX):"
echo "------------------------------------------"
echo "Limpando logs..."
docker exec autosheets_app truncate -s 0 /proc/1/fd/1 2>/dev/null || true
echo ""
echo "Enviando payload com reply_to_message..."

# Payload de teste com reply_to_message
REPLY_PAYLOAD='{
  "message": {
    "message_id": 789,
    "from": {
      "id": '$TEST_USER_ID',
      "first_name": "Test User",
      "username": "testuser"
    },
    "chat": {
      "id": '$TEST_USER_ID',
      "type": "private"
    },
    "date": '$(date +%s)',
    "text": "1.95",
    "reply_to_message": {
      "message_id": '$TEST_MESSAGE_ID',
      "from": {
        "id": 123456789,
        "is_bot": true,
        "first_name": "AutoSheets Bot"
      },
      "chat": {
        "id": '$TEST_USER_ID',
        "type": "private"
      },
      "date": '$(($(date +%s) - 60))',
      "text": "🎯 Aposta detectada no grupo!"
    }
  }
}'

# Testar via nginx (porta 8080)
RESPONSE=$(curl -s -X POST http://localhost:8080/api/telegram/webhook \
  -H "Content-Type: application/json" \
  -d "$REPLY_PAYLOAD" \
  -w "\nHTTP_CODE:%{http_code}")

echo "Resposta (via nginx): $RESPONSE"
echo ""

# Testar diretamente no container (porta 3000)
echo "Testando diretamente no container..."
RESPONSE_DIRECT=$(curl -s -X POST http://localhost:3000/api/telegram/webhook \
  -H "Content-Type: application/json" \
  -d "$REPLY_PAYLOAD" \
  -w "\nHTTP_CODE:%{http_code}" 2>/dev/null || echo "Erro: Porta 3000 não acessível")

echo "Resposta (direta): $RESPONSE_DIRECT"
echo ""

# 10. Aguardar processamento e verificar logs
echo "📋 VERIFICANDO LOGS DE PROCESSAMENTO:"
echo "------------------------------------"
sleep 5
PROCESSING_LOGS=$(docker logs autosheets_app --tail 50 2>/dev/null | grep -E "(📨|🔍|💰|reply_to_message|betKey|Processando|handleOddReply|removeBet)")

if [ -n "$PROCESSING_LOGS" ]; then
    echo "✅ Logs de processamento encontrados:"
    echo "$PROCESSING_LOGS"
    PROCESSING_OK=true
else
    echo "❌ Nenhum log de processamento encontrado"
    echo "Últimos logs do container:"
    docker logs autosheets_app --tail 10
    PROCESSING_OK=false
fi
echo ""

# 11. Verificar se a aposta foi removida do cache
echo "🔍 VERIFICANDO CACHE APÓS PROCESSAMENTO:"
echo "---------------------------------------"
if docker exec autosheets_app test -f ".bet-cache.json"; then
    CACHE_CONTENT=$(docker exec autosheets_app cat .bet-cache.json)
    if echo "$CACHE_CONTENT" | jq -e ".\"$TEST_KEY\"" >/dev/null 2>&1; then
        echo "❌ Aposta ainda está no cache - não foi processada"
        echo "Conteúdo do cache: $CACHE_CONTENT"
        CACHE_OK=false
    else
        echo "✅ Aposta removida do cache - processamento bem-sucedido!"
        CACHE_OK=true
    fi
else
    echo "✅ Cache vazio - aposta foi processada e removida"
    CACHE_OK=true
fi
echo ""

# 12. Verificar saúde dos serviços
echo "🏥 VERIFICANDO SAÚDE DOS SERVIÇOS:"
echo "---------------------------------"
echo "Status dos healthchecks:"
docker compose -f docker-compose.prod.yml ps --format "table {{.Name}}\t{{.Status}}"
echo ""

# 13. Relatório final
echo "📊 RELATÓRIO FINAL:"
echo "=================="
echo "TypeScript compilação: $([ "$TYPESCRIPT_OK" = true ] && echo "✅ OK" || echo "❌ ERRO")"
echo "Webhook resposta HTTP (nginx): $(echo "$RESPONSE" | grep -q "HTTP_CODE:200" && echo "✅ 200 OK" || echo "❌ ERRO")"
echo "Webhook resposta HTTP (direto): $(echo "$RESPONSE_DIRECT" | grep -q "HTTP_CODE:200" && echo "✅ 200 OK" || echo "❌ ERRO")"
echo "Logs de processamento: $([ "$PROCESSING_OK" = true ] && echo "✅ OK" || echo "❌ AUSENTES")"
echo "Cache processamento: $([ "$CACHE_OK" = true ] && echo "✅ OK" || echo "❌ ERRO")"
echo ""

if [ "$TYPESCRIPT_OK" = true ] && [ "$PROCESSING_OK" = true ] && [ "$CACHE_OK" = true ]; then
    echo "🎉 SUCESSO! O sistema de replies está funcionando corretamente!"
    echo "✅ Todos os testes passaram"
else
    echo "❌ AINDA HÁ PROBLEMAS:"
    [ "$TYPESCRIPT_OK" = false ] && echo "   - Erros de TypeScript impedem a compilação"
    [ "$PROCESSING_OK" = false ] && echo "   - Webhook não está processando as mensagens"
    [ "$CACHE_OK" = false ] && echo "   - Cache não está sendo atualizado corretamente"
fi
echo ""

echo "🔧 PRÓXIMOS PASSOS (se necessário):"
echo "===================================="
echo "1. Ver logs completos: docker logs -f autosheets_app"
echo "2. Entrar no container: docker exec -it autosheets_app /bin/sh"
echo "3. Verificar imports: grep -r '@/' src/app/api/telegram/webhook/"
echo "4. Testar manualmente (nginx): curl -X POST http://localhost:8080/api/telegram/webhook"
echo "5. Testar manualmente (direto): curl -X POST http://localhost:3000/api/telegram/webhook"
echo "6. Verificar variáveis de ambiente: docker exec autosheets_app env | grep -E '(NODE_ENV|TELEGRAM|GOOGLE)'"
echo ""