#!/bin/bash

# Script para diagnosticar logs específicos do webhook
echo "🔍 DEBUG DOS LOGS DO WEBHOOK"
echo "=============================="
echo ""

# Verificar se o container está rodando
echo "📋 VERIFICANDO STATUS DO CONTAINER:"
echo "----------------------------------"
docker ps --filter "name=autosheets_app" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# Limpar logs anteriores
echo "🧹 LIMPANDO LOGS ANTERIORES..."
docker logs autosheets_app --tail 0 > /dev/null 2>&1
echo "✅ Logs limpos"
echo ""

# Verificar cache atual
echo "📋 VERIFICANDO CACHE ATUAL:"
echo "---------------------------"
docker exec autosheets_app cat .bet-cache.json 2>/dev/null | jq . || echo "❌ Cache não encontrado"
echo ""

# Extrair uma chave do cache para teste
CACHE_CONTENT=$(docker exec autosheets_app cat .bet-cache.json 2>/dev/null)
if [ "$CACHE_CONTENT" != "" ] && [ "$CACHE_CONTENT" != "{}" ]; then
    FIRST_KEY=$(echo "$CACHE_CONTENT" | jq -r 'keys[0]')
    USER_ID=$(echo "$FIRST_KEY" | cut -d'_' -f1)
    MESSAGE_ID=$(echo "$FIRST_KEY" | cut -d'_' -f2)
    
    echo "🔑 Usando chave para teste: $FIRST_KEY"
    echo "👤 User ID: $USER_ID"
    echo "📨 Message ID: $MESSAGE_ID"
    echo ""
else
    echo "❌ Nenhuma aposta encontrada no cache"
    exit 1
fi

# Teste 1: Payload mínimo com logs detalhados
echo "🧪 TESTE 1: Payload mínimo"
echo "=========================="

# Criar payload de teste
PAYLOAD=$(cat <<EOF
{
  "update_id": 123456789,
  "message": {
    "message_id": 999,
    "from": {
      "id": $USER_ID,
      "is_bot": false,
      "first_name": "Test",
      "username": "testuser"
    },
    "chat": {
      "id": -4975465313,
      "title": "Test Group",
      "type": "supergroup"
    },
    "date": $(date +%s),
    "text": "1.85",
    "reply_to_message": {
      "message_id": $MESSAGE_ID,
      "from": {
        "id": 123456789,
        "is_bot": true,
        "first_name": "Bot",
        "username": "testbot"
      },
      "chat": {
        "id": -4975465313,
        "title": "Test Group",
        "type": "supergroup"
      },
      "date": $(date +%s),
      "text": "Mensagem original do bot"
    }
  }
}
EOF
)

echo "📤 Enviando payload..."
echo "Payload: $PAYLOAD" | jq .
echo ""

# Enviar para o webhook
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  http://localhost:3000/api/telegram/webhook)

echo "📥 Resposta: $RESPONSE"
echo ""

# Aguardar um pouco para os logs serem gerados
echo "⏳ Aguardando logs (3 segundos)..."
sleep 3

# Capturar logs específicos do webhook
echo "📊 LOGS ESPECÍFICOS DO WEBHOOK:"
echo "-------------------------------"
WEBHOOK_LOGS=$(docker logs autosheets_app --since 10s 2>&1 | grep -E "(🔄 Webhook recebido|📦 Update recebido|🔍 Tipo de update|📨 Mensagem de|🔍 Debug da chave|betKey gerada|Aposta encontrada|Nenhuma aposta pendente|reply_to_message)")

if [ "$WEBHOOK_LOGS" != "" ]; then
    echo "✅ Logs do webhook encontrados:"
    echo "$WEBHOOK_LOGS"
else
    echo "❌ Nenhum log específico do webhook encontrado"
    echo ""
    echo "📋 Todos os logs recentes:"
    docker logs autosheets_app --since 10s 2>&1 | tail -20
fi

echo ""
echo "🔍 ANÁLISE DOS LOGS:"
echo "-------------------"

# Verificar se o webhook foi chamado
if echo "$WEBHOOK_LOGS" | grep -q "🔄 Webhook recebido"; then
    echo "✅ Webhook foi chamado"
else
    echo "❌ Webhook NÃO foi chamado"
fi

# Verificar se o update foi recebido
if echo "$WEBHOOK_LOGS" | grep -q "📦 Update recebido"; then
    echo "✅ Update foi recebido"
else
    echo "❌ Update NÃO foi recebido"
fi

# Verificar se o tipo de update foi analisado
if echo "$WEBHOOK_LOGS" | grep -q "🔍 Tipo de update"; then
    echo "✅ Tipo de update foi analisado"
else
    echo "❌ Tipo de update NÃO foi analisado"
fi

# Verificar se a mensagem foi processada
if echo "$WEBHOOK_LOGS" | grep -q "📨 Mensagem de"; then
    echo "✅ Mensagem foi processada"
else
    echo "❌ Mensagem NÃO foi processada"
fi

# Verificar se o reply foi detectado
if echo "$WEBHOOK_LOGS" | grep -q "🔍 Debug da chave"; then
    echo "✅ Reply foi detectado"
else
    echo "❌ Reply NÃO foi detectado"
fi

echo ""
echo "🔍 VERIFICANDO CACHE FINAL:"
echo "============================"
docker exec autosheets_app cat .bet-cache.json 2>/dev/null | jq . || echo "❌ Cache não encontrado"

# Verificar se a aposta foi removida
FINAL_CACHE=$(docker exec autosheets_app cat .bet-cache.json 2>/dev/null)
if echo "$FINAL_CACHE" | jq -e ".\"$FIRST_KEY\"" > /dev/null 2>&1; then
    echo "❌ Aposta ainda está no cache (não foi processada)"
else
    echo "✅ Aposta foi removida do cache (processada com sucesso)"
fi

echo ""
echo "📋 RESUMO DO DIAGNÓSTICO:"
echo "========================"
echo "- Container: $(docker ps --filter 'name=autosheets_app' --format '{{.Status}}' | head -1)"
echo "- Webhook chamado: $(echo "$WEBHOOK_LOGS" | grep -q "🔄 Webhook recebido" && echo "SIM" || echo "NÃO")"
echo "- Update recebido: $(echo "$WEBHOOK_LOGS" | grep -q "📦 Update recebido" && echo "SIM" || echo "NÃO")"
echo "- Reply detectado: $(echo "$WEBHOOK_LOGS" | grep -q "🔍 Debug da chave" && echo "SIM" || echo "NÃO")"
echo "- Aposta processada: $(echo "$FINAL_CACHE" | jq -e ".\"$FIRST_KEY\"" > /dev/null 2>&1 && echo "NÃO" || echo "SIM")"
echo ""