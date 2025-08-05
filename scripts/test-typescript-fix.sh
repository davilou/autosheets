#!/bin/bash

# Script para testar se a correção do TypeScript funcionou
# Verifica compilação, reinicia o servidor e testa o webhook

echo "🔧 TESTANDO CORREÇÃO DO TYPESCRIPT"
echo "==================================="
echo ""

# 1. Verificar status do container
echo "📋 VERIFICANDO STATUS DO CONTAINER:"
echo "----------------------------------"
docker ps --filter name=autosheets_app --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# 2. Testar compilação TypeScript
echo "🔧 TESTANDO COMPILAÇÃO TYPESCRIPT:"
echo "---------------------------------"
echo "Testando compilação do webhook:"
docker exec autosheets_app npx tsc --noEmit src/app/api/telegram/webhook/route.ts
if [ $? -eq 0 ]; then
    echo "✅ Compilação TypeScript bem-sucedida!"
else
    echo "❌ Ainda há erros de TypeScript"
fi
echo ""

# 3. Limpar cache do Next.js
echo "🧹 LIMPANDO CACHE DO NEXT.JS:"
echo "-----------------------------"
docker exec autosheets_app rm -rf .next
docker exec autosheets_app npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Build do Next.js bem-sucedido!"
else
    echo "❌ Erro no build do Next.js"
fi
echo ""

# 4. Reiniciar o container
echo "🔄 REINICIANDO CONTAINER:"
echo "------------------------"
docker restart autosheets_app
echo "Aguardando container inicializar..."
sleep 10
echo ""

# 5. Verificar se o servidor está rodando
echo "📊 VERIFICANDO SERVIDOR:"
echo "-----------------------"
echo "Processos Node.js:"
docker exec autosheets_app ps aux | grep node | grep -v grep
echo ""
echo "Porta 3000:"
docker exec autosheets_app netstat -tlnp | grep :3000
echo ""

# 6. Testar webhook com payload simples
echo "🧪 TESTANDO WEBHOOK:"
echo "-------------------"
echo "Limpando logs..."
docker exec autosheets_app truncate -s 0 /proc/1/fd/1 2>/dev/null || true
echo ""
echo "Enviando payload de teste..."

# Payload de teste com reply_to_message
PAYLOAD='{
  "message": {
    "message_id": 123,
    "from": {
      "id": 987654321,
      "first_name": "Test User"
    },
    "chat": {
      "id": 987654321,
      "type": "private"
    },
    "date": 1640995200,
    "text": "1.95",
    "reply_to_message": {
      "message_id": 456,
      "from": {
        "id": 123456789,
        "is_bot": true,
        "first_name": "Bot"
      },
      "chat": {
        "id": 987654321,
        "type": "private"
      },
      "date": 1640995100,
      "text": "Aposta detectada"
    }
  }
}'

RESPONSE=$(curl -s -X POST http://localhost:3000/api/telegram/webhook \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  -w "\nHTTP_CODE:%{http_code}")

echo "Resposta: $RESPONSE"
echo ""

# 7. Verificar logs após o teste
echo "📋 LOGS APÓS O TESTE:"
echo "--------------------"
sleep 2
docker logs autosheets_app --tail 20 2>/dev/null | grep -E "(webhook|POST|reply|betKey|💰|🔍|📨|✅|❌)" || echo "Nenhum log relevante encontrado"
echo ""

# 8. Análise final
echo "📋 ANÁLISE FINAL:"
echo "================="
if echo "$RESPONSE" | grep -q "HTTP_CODE:200"; then
    echo "✅ Webhook respondeu com sucesso (HTTP 200)"
    
    # Verificar se há logs de processamento
    PROCESSING_LOGS=$(docker logs autosheets_app --tail 50 2>/dev/null | grep -E "(reply_to_message|betKey|💰|Processando)" | wc -l)
    
    if [ "$PROCESSING_LOGS" -gt 0 ]; then
        echo "✅ Logs de processamento detectados - webhook está funcionando!"
        echo "🎉 CORREÇÃO BEM-SUCEDIDA!"
    else
        echo "⚠️ Webhook responde mas não há logs de processamento"
        echo "💡 Pode ser necessário verificar a lógica interna"
    fi
else
    echo "❌ Webhook não está respondendo corretamente"
    echo "💡 Verificar se o servidor está rodando na porta 3000"
fi
echo ""

echo "🔧 COMANDOS ÚTEIS:"
echo "=================="
echo "1. Ver logs em tempo real: docker logs -f autosheets_app"
echo "2. Entrar no container: docker exec -it autosheets_app /bin/sh"
echo "3. Testar compilação: docker exec autosheets_app npx tsc --noEmit"
echo "4. Verificar rotas: curl http://localhost:3000/api/telegram/webhook"
echo ""