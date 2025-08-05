#!/bin/bash

# Script para testar se os logs do webhook estão sendo gerados corretamente

echo "🔍 TESTE DE LOGS DO WEBHOOK"
echo "============================="
echo ""

# Verificar se o container está rodando
echo "📦 VERIFICANDO STATUS DO CONTAINER:"
echo "----------------------------------"
docker ps | grep autosheets_app
echo ""

# Limpar logs anteriores
echo "🧹 LIMPANDO LOGS ANTERIORES:"
echo "----------------------------"
docker logs autosheets_app --tail 0 > /dev/null 2>&1
echo "✅ Logs limpos"
echo ""

# Verificar cache atual
echo "📋 CACHE ATUAL:"
echo "--------------"
CACHE_CONTENT=$(docker exec autosheets_app cat .bet-cache.json 2>/dev/null || echo "{}")
echo "$CACHE_CONTENT" | jq .
echo ""

# Extrair primeira chave do cache para teste
FIRST_KEY=$(echo "$CACHE_CONTENT" | jq -r 'keys[0] // empty')

if [ -z "$FIRST_KEY" ] || [ "$FIRST_KEY" = "null" ]; then
    echo "❌ Nenhuma aposta no cache para testar"
    exit 1
fi

echo "🔑 Usando chave para teste: $FIRST_KEY"

# Extrair userId e messageId da chave
USER_ID=$(echo "$FIRST_KEY" | cut -d'_' -f1)
MESSAGE_ID=$(echo "$FIRST_KEY" | cut -d'_' -f2)

echo "👤 User ID: $USER_ID"
echo "📨 Message ID: $MESSAGE_ID"
echo ""

# Criar payload de teste simples
echo "📝 CRIANDO PAYLOAD DE TESTE:"
echo "----------------------------"
PAYLOAD=$(cat <<EOF
{
  "update_id": 123456789,
  "message": {
    "message_id": 999,
    "from": {
      "id": $USER_ID,
      "is_bot": false,
      "first_name": "Teste",
      "username": "teste_user"
    },
    "chat": {
      "id": $USER_ID,
      "first_name": "Teste",
      "username": "teste_user",
      "type": "private"
    },
    "date": $(date +%s),
    "text": "1.85",
    "reply_to_message": {
      "message_id": $MESSAGE_ID,
      "from": {
        "id": 7506384797,
        "is_bot": true,
        "first_name": "AutoSheets"
      },
      "chat": {
        "id": $USER_ID,
        "type": "private"
      },
      "date": $(date +%s),
      "text": "Teste de reply"
    }
  }
}
EOF
)

echo "📋 Payload criado:"
echo "$PAYLOAD" | jq .
echo ""

# Iniciar monitoramento de logs em background
echo "📊 INICIANDO MONITORAMENTO DE LOGS:"
echo "-----------------------------------"
echo "⏳ Aguardando 2 segundos para inicializar..."
sleep 2

# Capturar logs em background
docker logs -f autosheets_app > /tmp/webhook_logs.txt 2>&1 &
LOGS_PID=$!

echo "📤 ENVIANDO PAYLOAD PARA WEBHOOK:"
echo "--------------------------------"
echo "🌐 URL: https://autosheets.loudigital.shop/api/telegram/webhook"

# Enviar payload
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  "https://autosheets.loudigital.shop/api/telegram/webhook")

echo "📥 Resposta do webhook:"
echo "$RESPONSE"
echo ""

# Aguardar logs serem gerados
echo "⏳ Aguardando 5 segundos para capturar logs..."
sleep 5

# Parar captura de logs
kill $LOGS_PID 2>/dev/null

echo "📊 LOGS CAPTURADOS:"
echo "=================="
echo ""
echo "🔍 Logs completos do webhook:"
echo "-----------------------------"
cat /tmp/webhook_logs.txt | tail -50
echo ""

echo "🔍 Logs específicos do processamento:"
echo "------------------------------------"
echo "📦 Logs de 'Update recebido':"
grep -i "update recebido" /tmp/webhook_logs.txt || echo "❌ Não encontrado"
echo ""
echo "🔍 Logs de 'Tipo de update':"
grep -i "tipo de update" /tmp/webhook_logs.txt || echo "❌ Não encontrado"
echo ""
echo "📨 Logs de 'Mensagem de':"
grep -i "mensagem de" /tmp/webhook_logs.txt || echo "❌ Não encontrado"
echo ""
echo "🔍 Logs de 'Debug da chave':"
grep -i "debug da chave" /tmp/webhook_logs.txt || echo "❌ Não encontrado"
echo ""
echo "💰 Logs de 'Processando resposta':"
grep -i "processando resposta" /tmp/webhook_logs.txt || echo "❌ Não encontrado"
echo ""

# Verificar cache após teste
echo "🔍 VERIFICANDO CACHE APÓS TESTE:"
echo "================================"
CACHE_AFTER=$(docker exec autosheets_app cat .bet-cache.json 2>/dev/null || echo "{}")
echo "$CACHE_AFTER" | jq .
echo ""

# Verificar se a aposta foi removida
if echo "$CACHE_AFTER" | jq -e ".\"$FIRST_KEY\"" > /dev/null; then
    echo "❌ APOSTA AINDA ESTÁ NO CACHE - NÃO foi processada"
else
    echo "✅ APOSTA FOI REMOVIDA DO CACHE - Processada com sucesso"
fi
echo ""

echo "📊 DIAGNÓSTICO:"
echo "==============="
echo "1. Webhook acessível: $(echo "$RESPONSE" | grep -q "HTTP_CODE:200" && echo "✅ Sim" || echo "❌ Não")"
echo "2. Logs de webhook gerados: $(grep -q "update recebido" /tmp/webhook_logs.txt && echo "✅ Sim" || echo "❌ Não")"
echo "3. Detecção de reply: $(grep -q "debug da chave" /tmp/webhook_logs.txt && echo "✅ Sim" || echo "❌ Não")"
echo "4. Processamento executado: $(grep -q "processando resposta" /tmp/webhook_logs.txt && echo "✅ Sim" || echo "❌ Não")"
echo "5. Aposta removida: $(echo "$CACHE_AFTER" | jq -e ".\"$FIRST_KEY\"" > /dev/null && echo "❌ Não" || echo "✅ Sim")"
echo ""

# Limpar arquivo temporário
rm -f /tmp/webhook_logs.txt

echo "✅ Teste concluído!"