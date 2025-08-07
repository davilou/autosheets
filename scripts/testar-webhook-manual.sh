#!/bin/bash

# 🧪 TESTE MANUAL DO WEBHOOK - SIMULAÇÃO DE REPLY
# ==============================================

echo "🧪 TESTE MANUAL DO WEBHOOK - SIMULAÇÃO DE REPLY"
echo "==============================================="
echo ""

# Verificar se há apostas no cache
echo "📦 VERIFICANDO CACHE ATUAL:"
echo "---------------------------"
CACHE_CONTENT=$(docker compose -f docker-compose.prod.yml exec autosheets cat .bet-cache.json 2>/dev/null)
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
        
        # Criar payload de teste simulando um reply do Telegram
        WEBHOOK_PAYLOAD=$(cat <<EOF
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
        "id": 7474807896,
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
      "text": "🎯 Aposta detectada no grupo!"
    }
  }
}
EOF
        )
        
        echo "📡 PAYLOAD DE TESTE:"
        echo "-------------------"
        echo "$WEBHOOK_PAYLOAD" | jq .
        echo ""
        
        echo "🚀 ENVIANDO TESTE PARA O WEBHOOK:"
        echo "---------------------------------"
        
        # Iniciar monitoramento de logs em background
        echo "📊 Iniciando monitoramento de logs..."
        docker compose -f docker-compose.prod.yml logs -f autosheets &
        LOGS_PID=$!
        
        sleep 2
        
        # Enviar request para o webhook
        echo "📤 Enviando request..."
        RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
            -X POST \
            -H "Content-Type: application/json" \
            -d "$WEBHOOK_PAYLOAD" \
            "https://autosheets.loudigital.shop/api/telegram/webhook")
        
        echo "📥 RESPOSTA DO WEBHOOK:"
        echo "----------------------"
        echo "$RESPONSE"
        echo ""
        
        # Aguardar processamento
        echo "⏳ Aguardando processamento (10 segundos)..."
        sleep 10
        
        # Parar monitoramento de logs
        kill $LOGS_PID 2>/dev/null
        
        echo "📦 VERIFICANDO CACHE APÓS TESTE:"
        echo "--------------------------------"
        NEW_CACHE=$(docker compose -f docker-compose.prod.yml exec autosheets cat .bet-cache.json 2>/dev/null)
        if [ $? -eq 0 ]; then
            echo "$NEW_CACHE" | jq .
            
            # Verificar se a chave foi removida
            KEY_EXISTS=$(echo "$NEW_CACHE" | jq -r "has(\"$FIRST_KEY\")")
            if [ "$KEY_EXISTS" = "false" ]; then
                echo "✅ Chave removida do cache - Reply processado com sucesso!"
            else
                echo "❌ Chave ainda existe no cache - Reply não foi processado"
            fi
        else
            echo "❌ Cache não encontrado após teste"
        fi
        
    else
        echo "❌ Nenhuma chave encontrada no cache para teste"
        echo "💡 Execute primeiro uma detecção de aposta para criar uma entrada no cache"
    fi
else
    echo "❌ Cache não encontrado"
    echo "💡 Execute primeiro uma detecção de aposta para criar o cache"
fi

echo ""
echo "🎯 ANÁLISE DO TESTE:"
echo "===================="
echo "1. ✅ Se a chave foi removida do cache = Reply processado"
echo "2. ❌ Se a chave permanece no cache = Reply não processado"
echo "3. 📊 Verificar logs acima para detalhes do processamento"
echo "4. 🔍 Procurar por mensagens como '[CACHE]', '💰 Processando', 'betKey'"
echo ""