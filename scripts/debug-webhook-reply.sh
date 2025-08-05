#!/bin/bash

# 🔍 DEBUG WEBHOOK REPLY - Diagnóstico Detalhado
# ===============================================

echo "🔍 DEBUG WEBHOOK REPLY - Diagnóstico Detalhado"
echo "==============================================="
echo ""

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
        
        # Criar payload de teste com logs detalhados
        echo "📝 Criando payload de teste..."
        cat > test_payload_debug.json <<EOF
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
        
        echo "📋 Payload criado:"
        cat test_payload_debug.json | jq .
        echo ""
        
        # Iniciar monitoramento de logs em background
        echo "📊 Iniciando monitoramento de logs..."
        docker compose -f docker-compose.prod.yml logs -f autosheets > webhook_logs.txt 2>&1 &
        LOG_PID=$!
        
        echo "⏳ Aguardando 2 segundos para inicializar logs..."
        sleep 2
        
        # Enviar payload para webhook
        echo "📤 Enviando payload para webhook..."
        echo "🌐 URL: https://autosheets.loudigital.shop/api/telegram/webhook"
        
        response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            -d @test_payload_debug.json \
            https://autosheets.loudigital.shop/api/telegram/webhook)
        
        echo "📥 Resposta do webhook:"
        echo "$response"
        echo ""
        
        # Aguardar processamento
        echo "⏳ Aguardando 10 segundos para capturar logs..."
        sleep 10
        
        # Parar monitoramento de logs
        kill $LOG_PID 2>/dev/null
        
        # Analisar logs capturados
        echo "📊 ANÁLISE DOS LOGS CAPTURADOS:"
        echo "================================"
        
        if [ -f "webhook_logs.txt" ]; then
            echo "🔍 Logs relacionados ao webhook:"
            grep -E "(webhook|reply|betKey|Processando|cache|Update recebido|Debug da chave)" webhook_logs.txt | tail -20
            echo ""
            
            echo "🔍 Logs de processamento de mensagem:"
            grep -E "(Mensagem de|reply_to_message|betKey gerada|Procurando aposta)" webhook_logs.txt | tail -10
            echo ""
            
            echo "🔍 Logs de cache:"
            grep -E "(cache|Cache|CACHE)" webhook_logs.txt | tail -10
            echo ""
            
            echo "🔍 Logs de erro:"
            grep -E "(❌|erro|error|Error|ERROR)" webhook_logs.txt | tail -5
            echo ""
        else
            echo "❌ Arquivo de logs não encontrado"
        fi
        
        # Verificar resultado no cache
        echo "🔍 VERIFICANDO RESULTADO NO CACHE:"
        echo "=================================="
        NEW_CACHE=$(docker exec autosheets_app cat .bet-cache.json)
        if echo "$NEW_CACHE" | jq -e ".\"$FIRST_KEY\"" >/dev/null 2>&1; then
            echo "❌ Aposta ainda está no cache - NÃO foi processada"
            echo "📋 Cache atual:"
            echo "$NEW_CACHE" | jq .
        else
            echo "✅ Aposta foi removida do cache - processada com sucesso!"
            echo "📋 Cache atual:"
            echo "$NEW_CACHE" | jq .
        fi
        
        echo ""
        echo "📊 DIAGNÓSTICO COMPLETO:"
        echo "========================"
        echo "1. Webhook respondeu: $(echo "$response" | grep HTTP_CODE | cut -d: -f2)"
        echo "2. Aposta no cache antes: ✅"
        echo "3. Aposta no cache depois: $(if echo "$NEW_CACHE" | jq -e ".\"$FIRST_KEY\"" >/dev/null 2>&1; then echo "❌ Ainda presente"; else echo "✅ Removida"; fi)"
        echo "4. Logs capturados: $(if [ -f "webhook_logs.txt" ]; then echo "✅"; else echo "❌"; fi)"
        
        # Limpeza
        rm -f test_payload_debug.json webhook_logs.txt
        
    else
        echo "❌ Nenhuma aposta encontrada no cache para teste"
    fi
else
    echo "❌ Cache não encontrado no container"
fi

echo ""
echo "🏁 Diagnóstico de webhook reply concluído!"
echo "==========================================="
echo ""
echo "📋 Próximos passos:"
echo "1. Se a aposta não foi removida, há problema no processamento do reply"
echo "2. Verifique os logs para identificar onde o processamento falha"
echo "3. Confirme se o webhook está detectando reply_to_message corretamente"
echo "4. Verifique se a chave betKey está sendo gerada corretamente"