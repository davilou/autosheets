#!/bin/bash

# Script para testar replies diretamente no container
# Funciona dentro do ambiente Docker onde o cache está sendo salvo

echo "🚀 Testando sistema de replies no container..."
echo "============================================="

# 1. Verificar status dos serviços
echo "📊 Status dos serviços:"
docker compose -f docker-compose.prod.yml ps
echo ""

# 2. Verificar cache no container
echo "💾 Verificando cache no container:"
if docker exec autosheets_app test -f ".bet-cache.json"; then
    echo "✅ Cache encontrado!"
    echo "📋 Conteúdo atual do cache:"
    CACHE_CONTENT=$(docker exec autosheets_app cat .bet-cache.json)
    echo "$CACHE_CONTENT" | jq . 2>/dev/null || echo "$CACHE_CONTENT"
    
    # Extrair primeira chave para teste
    BET_KEY=$(echo "$CACHE_CONTENT" | jq -r 'keys[0]' 2>/dev/null)
    
    if [ "$BET_KEY" != "null" ] && [ "$BET_KEY" != "" ]; then
        echo "🔑 Chave de teste: $BET_KEY"
        
        # Extrair dados
        USER_ID=$(echo "$BET_KEY" | cut -d'_' -f1)
        MESSAGE_ID=$(echo "$BET_KEY" | cut -d'_' -f2)
        
        echo "👤 User ID: $USER_ID"
        echo "📨 Message ID: $MESSAGE_ID"
        echo ""
        
        # Criar payload de teste
        cat > test_payload.json << EOF
{
  "message": {
    "message_id": $MESSAGE_ID,
    "from": {
      "id": $USER_ID,
      "first_name": "TestUser"
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
      "text": "Teste de reply"
    }
  }
}
EOF
        
        echo "📤 Enviando payload para webhook..."
        echo "🌐 URL: https://autosheets.loudigital.shop/api/telegram/webhook"
        
        # Testar webhook
        response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            -d @test_payload.json \
            https://autosheets.loudigital.shop/api/telegram/webhook)
        
        echo "📥 Resposta completa:"
        echo "$response"
        echo ""
        
        # Aguardar processamento
        echo "⏳ Aguardando 5 segundos para processamento..."
        sleep 5
        
        # Verificar resultado no container
        echo "🔍 Verificando resultado no container..."
        if docker exec autosheets_app test -f ".bet-cache.json"; then
            NEW_CACHE=$(docker exec autosheets_app cat .bet-cache.json)
            if echo "$NEW_CACHE" | jq -e ".\"$BET_KEY\"" >/dev/null 2>&1; then
                echo "❌ Aposta ainda está no cache - pode não ter sido processada"
                echo "📋 Cache atual:"
                echo "$NEW_CACHE" | jq . 2>/dev/null || echo "$NEW_CACHE"
            else
                echo "✅ Aposta removida do cache - processamento bem-sucedido!"
                echo "📋 Cache atual:"
                echo "$NEW_CACHE" | jq . 2>/dev/null || echo "$NEW_CACHE"
            fi
        else
            echo "❌ Cache não encontrado após teste"
        fi
        
        # Limpar arquivo temporário
        rm -f test_payload.json
        
    else
        echo "❌ Nenhuma chave válida encontrada no cache"
    fi
else
    echo "❌ Cache não encontrado no container"
    echo "🔍 Verificando se existe em outro local..."
    docker exec autosheets_app find / -name "*.json" -path "*/cache*" 2>/dev/null | head -5
fi

echo ""
echo "📝 Logs recentes do webhook:"
docker compose -f docker-compose.prod.yml logs --tail=10 autosheets_app | grep -E "(webhook|reply|POST|💰|💾)"

echo ""
echo "🏁 Teste concluído!"
echo "============================================="
echo ""
echo "📋 Para monitorar em tempo real, execute em outro terminal:"
echo "docker compose -f docker-compose.prod.yml logs -f autosheets_app | grep -E '(💰|reply|betKey|Processando|cache|✅|❌)'"