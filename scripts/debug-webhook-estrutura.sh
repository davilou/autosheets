#!/bin/bash

# Script para diagnosticar a estrutura do código do webhook
echo "🔍 DEBUG DA ESTRUTURA DO WEBHOOK"
echo "==============================="
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

# Teste 1: Verificar se o endpoint está respondendo
echo "🧪 TESTE 1: Verificar endpoint básico"
echo "====================================="

RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:3000/api/telegram/webhook)

echo "📥 Resposta para payload vazio: $RESPONSE"
echo ""

# Aguardar logs
sleep 2

# Capturar logs
LOGS_TESTE1=$(docker logs autosheets_app --since 5s 2>&1)
echo "📊 Logs do teste 1:"
echo "$LOGS_TESTE1" | tail -10
echo ""

# Teste 2: Payload com estrutura mínima
echo "🧪 TESTE 2: Payload com estrutura mínima"
echo "========================================"

PAYLOAD_MIN=$(cat <<EOF
{
  "update_id": 123,
  "message": {
    "message_id": 456,
    "text": "teste",
    "from": {"id": 789},
    "chat": {"id": -123}
  }
}
EOF
)

echo "📤 Enviando payload mínimo..."
echo "$PAYLOAD_MIN" | jq .

RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD_MIN" \
  http://localhost:3000/api/telegram/webhook)

echo "📥 Resposta: $RESPONSE"
echo ""

# Aguardar logs
sleep 2

# Capturar logs específicos
LOGS_TESTE2=$(docker logs autosheets_app --since 5s 2>&1)
echo "📊 Logs do teste 2:"
echo "$LOGS_TESTE2" | grep -E "(🔄|📦|🔍|📨|ℹ️)" || echo "❌ Nenhum log específico encontrado"
echo ""

# Teste 3: Payload com reply_to_message
echo "🧪 TESTE 3: Payload com reply_to_message"
echo "========================================"

PAYLOAD_REPLY=$(cat <<EOF
{
  "update_id": 124,
  "message": {
    "message_id": 457,
    "text": "1.85",
    "from": {"id": 670237902},
    "chat": {"id": -4975465313},
    "reply_to_message": {
      "message_id": 404,
      "text": "mensagem original",
      "from": {"id": 123},
      "chat": {"id": -4975465313}
    }
  }
}
EOF
)

echo "📤 Enviando payload com reply..."
echo "$PAYLOAD_REPLY" | jq .

RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD_REPLY" \
  http://localhost:3000/api/telegram/webhook)

echo "📥 Resposta: $RESPONSE"
echo ""

# Aguardar logs
sleep 3

# Capturar todos os logs recentes
LOGS_TESTE3=$(docker logs autosheets_app --since 10s 2>&1)
echo "📊 Logs do teste 3 (completos):"
echo "$LOGS_TESTE3"
echo ""

# Análise detalhada
echo "🔍 ANÁLISE DETALHADA:"
echo "====================="

# Verificar se o webhook está sendo chamado
if echo "$LOGS_TESTE3" | grep -q "🔄 Webhook recebido"; then
    echo "✅ Webhook está sendo chamado"
else
    echo "❌ Webhook NÃO está sendo chamado"
fi

# Verificar se o JSON está sendo parseado
if echo "$LOGS_TESTE3" | grep -q "📦 Update recebido"; then
    echo "✅ JSON está sendo parseado"
else
    echo "❌ JSON NÃO está sendo parseado"
fi

# Verificar se a análise do tipo está funcionando
if echo "$LOGS_TESTE3" | grep -q "🔍 Tipo de update"; then
    echo "✅ Análise do tipo de update está funcionando"
else
    echo "❌ Análise do tipo de update NÃO está funcionando"
fi

# Verificar se a mensagem está sendo processada
if echo "$LOGS_TESTE3" | grep -q "📨 Mensagem de"; then
    echo "✅ Mensagem está sendo processada"
else
    echo "❌ Mensagem NÃO está sendo processada"
fi

# Verificar se o reply está sendo detectado
if echo "$LOGS_TESTE3" | grep -q "reply_to_message"; then
    echo "✅ reply_to_message está sendo detectado"
else
    echo "❌ reply_to_message NÃO está sendo detectado"
fi

echo ""
echo "📋 POSSÍVEIS PROBLEMAS IDENTIFICADOS:"
echo "====================================="

if ! echo "$LOGS_TESTE3" | grep -q "🔄 Webhook recebido"; then
    echo "❌ O webhook não está sendo executado - problema de roteamento"
elif ! echo "$LOGS_TESTE3" | grep -q "📦 Update recebido"; then
    echo "❌ O JSON não está sendo parseado - problema de parsing"
elif ! echo "$LOGS_TESTE3" | grep -q "🔍 Tipo de update"; then
    echo "❌ A análise do update não está funcionando - problema de lógica"
elif ! echo "$LOGS_TESTE3" | grep -q "📨 Mensagem de"; then
    echo "❌ O processamento da mensagem não está funcionando - problema de condicionais"
else
    echo "✅ A estrutura básica parece estar funcionando"
    if ! echo "$LOGS_TESTE3" | grep -q "reply_to_message"; then
        echo "❌ Mas a detecção de reply não está funcionando"
    fi
fi

echo ""
echo "🔧 PRÓXIMOS PASSOS RECOMENDADOS:"
echo "================================"
echo "1. Verificar se o código está sendo recompilado corretamente"
echo "2. Verificar se há erros de sintaxe no TypeScript"
echo "3. Verificar se as variáveis de ambiente estão corretas"
echo "4. Verificar se o Next.js está servindo a rota corretamente"
echo ""