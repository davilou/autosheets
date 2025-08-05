#!/bin/bash

# 🧪 TESTE DE DETECÇÃO DE REPLY - Webhook
# ======================================

echo "🧪 TESTE DE DETECÇÃO DE REPLY - Webhook"
echo "======================================"
echo ""

# Função para testar payload
test_payload() {
    local test_name="$1"
    local payload_file="$2"
    
    echo "📋 Teste: $test_name"
    echo "------------------------"
    
    # Mostrar payload
    echo "📦 Payload enviado:"
    cat "$payload_file" | jq .
    echo ""
    
    # Enviar para webhook
    echo "📤 Enviando para webhook..."
    response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d @"$payload_file" \
        https://autosheets.loudigital.shop/api/telegram/webhook)
    
    echo "📥 Resposta:"
    echo "$response"
    echo ""
    
    # Aguardar um pouco
    sleep 2
    echo "═══════════════════════════════════════"
    echo ""
}

# Verificar se há apostas no cache
echo "📦 VERIFICANDO CACHE ATUAL:"
echo "---------------------------"
CACHE_CONTENT=$(docker exec autosheets_app cat .bet-cache.json 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ Cache encontrado:"
    echo "$CACHE_CONTENT" | jq .
    
    # Extrair a primeira chave disponível
    FIRST_KEY=$(echo "$CACHE_CONTENT" | jq -r 'keys[0]')
    if [ "$FIRST_KEY" != "null" ] && [ "$FIRST_KEY" != "" ]; then
        echo ""
        echo "🔑 Usando chave para teste: $FIRST_KEY"
        
        # Extrair userId e messageId da chave
        USER_ID=$(echo "$FIRST_KEY" | cut -d'_' -f1)
        MESSAGE_ID=$(echo "$FIRST_KEY" | cut -d'_' -f2)
        
        echo "👤 User ID: $USER_ID"
        echo "📨 Message ID: $MESSAGE_ID"
        echo ""
        
        # TESTE 1: Payload simples sem reply
        cat > test1_no_reply.json <<EOF
{
  "update_id": 123456789,
  "message": {
    "message_id": 999,
    "from": {
      "id": $USER_ID,
      "is_bot": false,
      "first_name": "Teste"
    },
    "chat": {
      "id": $USER_ID,
      "type": "private"
    },
    "date": $(date +%s),
    "text": "1.85"
  }
}
EOF
        
        # TESTE 2: Payload com reply_to_message
        cat > test2_with_reply.json <<EOF
{
  "update_id": 123456790,
  "message": {
    "message_id": 1000,
    "from": {
      "id": $USER_ID,
      "is_bot": false,
      "first_name": "Teste"
    },
    "chat": {
      "id": $USER_ID,
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
      "text": "Mensagem do bot"
    }
  }
}
EOF
        
        # TESTE 3: Payload com reply_to_message e estrutura completa
        cat > test3_complete_reply.json <<EOF
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
        "first_name": "AutoSheets",
        "username": "autosheets_bot"
      },
      "chat": {
        "id": $USER_ID,
        "first_name": "Teste",
        "username": "teste_user",
        "type": "private"
      },
      "date": $(date +%s),
      "text": "🎯 Aposta detectada no grupo!\n\n⚽️ Jogo: Teste\n💰 Odd Tipster: 1.72\n\n💎 Responda esta mensagem com a odd real"
    }
  }
}
EOF
        
        echo "🚀 Iniciando testes de detecção de reply..."
        echo ""
        
        # Executar testes
        test_payload "Mensagem SEM reply" "test1_no_reply.json"
        test_payload "Mensagem COM reply (básico)" "test2_with_reply.json"
        test_payload "Mensagem COM reply (completo)" "test3_complete_reply.json"
        
        # Verificar resultado final no cache
        echo "🔍 VERIFICANDO RESULTADO FINAL NO CACHE:"
        echo "========================================"
        FINAL_CACHE=$(docker exec autosheets_app cat .bet-cache.json)
        if echo "$FINAL_CACHE" | jq -e ".\"$FIRST_KEY\"" >/dev/null 2>&1; then
            echo "❌ Aposta ainda está no cache - nenhum teste processou com sucesso"
            echo "📋 Cache atual:"
            echo "$FINAL_CACHE" | jq .
        else
            echo "✅ Aposta foi removida do cache - algum teste funcionou!"
            echo "📋 Cache atual:"
            echo "$FINAL_CACHE" | jq .
        fi
        
        # Limpeza
        rm -f test1_no_reply.json test2_with_reply.json test3_complete_reply.json
        
    else
        echo "❌ Nenhuma aposta encontrada no cache para teste"
    fi
else
    echo "❌ Cache não encontrado no container"
fi

echo ""
echo "🏁 Teste de detecção de reply concluído!"
echo "========================================"
echo ""
echo "📋 Análise dos resultados:"
echo "1. Se nenhum teste removeu a aposta do cache, há problema na lógica do webhook"
echo "2. Se apenas o teste COM reply funcionou, a detecção está correta"
echo "3. Se todos os testes falharam, verifique os logs do container para erros"
echo "4. Execute: docker compose -f docker-compose.prod.yml logs autosheets | tail -50"