#!/bin/bash

# Script para debugar a estrutura do payload e detecção de reply_to_message

echo "🔍 DEBUG DA ESTRUTURA DO PAYLOAD"
echo "==============================="
echo ""

# Verificar cache atual
echo "📋 VERIFICANDO CACHE ATUAL:"
echo "---------------------------"
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

# Função para testar payload
test_payload() {
    local test_name="$1"
    local payload="$2"
    
    echo "🧪 TESTE: $test_name"
    echo "$(printf '=%.0s' {1..50})"
    
    # Limpar logs
    docker logs autosheets_app --tail 0 > /dev/null 2>&1
    
    # Capturar logs em background
    docker logs -f autosheets_app > "/tmp/test_${test_name// /_}_logs.txt" 2>&1 &
    local logs_pid=$!
    
    sleep 1
    
    echo "📤 Enviando payload..."
    local response=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d "$payload" \
      "https://autosheets.loudigital.shop/api/telegram/webhook")
    
    echo "📥 Resposta: $response"
    
    sleep 3
    kill $logs_pid 2>/dev/null
    
    echo "📊 Logs capturados:"
    echo "------------------"
    local log_file="/tmp/test_${test_name// /_}_logs.txt"
    
    # Verificar se logs foram gerados
    if [ -s "$log_file" ]; then
        echo "✅ Logs gerados:"
        tail -20 "$log_file"
        
        # Verificar detecção específica
        echo ""
        echo "🔍 Detecção de reply_to_message:"
        if grep -q "hasReplyTo.*true" "$log_file"; then
            echo "✅ reply_to_message detectado"
        else
            echo "❌ reply_to_message NÃO detectado"
        fi
        
        if grep -q "Debug da chave" "$log_file"; then
            echo "✅ Debug da chave executado"
        else
            echo "❌ Debug da chave NÃO executado"
        fi
        
        if grep -q "Processando resposta" "$log_file"; then
            echo "✅ Processamento executado"
        else
            echo "❌ Processamento NÃO executado"
        fi
    else
        echo "❌ Nenhum log gerado"
    fi
    
    echo ""
    echo "$(printf '=%.0s' {1..50})"
    echo ""
}

# TESTE 1: Payload sem reply_to_message
echo "🧪 PREPARANDO TESTE 1: Sem reply_to_message"
PAYLOAD_1=$(cat <<EOF
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
    "text": "1.85"
  }
}
EOF
)

test_payload "Sem reply_to_message" "$PAYLOAD_1"

# TESTE 2: Payload com reply_to_message básico
echo "🧪 PREPARANDO TESTE 2: Com reply_to_message básico"
PAYLOAD_2=$(cat <<EOF
{
  "update_id": 123456790,
  "message": {
    "message_id": 1000,
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
      "message_id": $MESSAGE_ID
    }
  }
}
EOF
)

test_payload "Com reply básico" "$PAYLOAD_2"

# TESTE 3: Payload com reply_to_message completo
echo "🧪 PREPARANDO TESTE 3: Com reply_to_message completo"
PAYLOAD_3=$(cat <<EOF
{
  "update_id": 123456791,
  "message": {
    "message_id": 1001,
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
      "text": "Mensagem original do bot"
    }
  }
}
EOF
)

test_payload "Com reply completo" "$PAYLOAD_3"

# Verificar cache final
echo "🔍 VERIFICANDO CACHE FINAL:"
echo "==========================="
CACHE_FINAL=$(docker exec autosheets_app cat .bet-cache.json 2>/dev/null || echo "{}")
echo "$CACHE_FINAL" | jq .
echo ""

# Verificar se a aposta foi removida
if echo "$CACHE_FINAL" | jq -e ".\"$FIRST_KEY\"" > /dev/null; then
    echo "❌ APOSTA AINDA ESTÁ NO CACHE após todos os testes"
else
    echo "✅ APOSTA FOI REMOVIDA DO CACHE em algum teste"
fi
echo ""

echo "📊 RESUMO DOS TESTES:"
echo "===================="
echo "1. Teste sem reply: $([ -f "/tmp/test_Sem_reply_to_message_logs.txt" ] && echo "✅ Executado" || echo "❌ Falhou")"
echo "2. Teste reply básico: $([ -f "/tmp/test_Com_reply_básico_logs.txt" ] && echo "✅ Executado" || echo "❌ Falhou")"
echo "3. Teste reply completo: $([ -f "/tmp/test_Com_reply_completo_logs.txt" ] && echo "✅ Executado" || echo "❌ Falhou")"
echo ""

echo "🔍 ANÁLISE DETALHADA:"
echo "====================="
for test_file in /tmp/test_*_logs.txt; do
    if [ -f "$test_file" ]; then
        test_name=$(basename "$test_file" | sed 's/test_//; s/_logs.txt//; s/_/ /g')
        echo "📋 $test_name:"
        echo "   - Logs gerados: $([ -s "$test_file" ] && echo "✅" || echo "❌")"
        echo "   - Reply detectado: $(grep -q "hasReplyTo.*true" "$test_file" && echo "✅" || echo "❌")"
        echo "   - Debug executado: $(grep -q "Debug da chave" "$test_file" && echo "✅" || echo "❌")"
        echo "   - Processamento: $(grep -q "Processando resposta" "$test_file" && echo "✅" || echo "❌")"
        echo ""
    fi
done

# Limpar arquivos temporários
rm -f /tmp/test_*_logs.txt

echo "✅ Debug da estrutura do payload concluído!"