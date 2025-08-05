#!/bin/bash
# Script de teste para replies em produção

echo "🔍 Testando sistema de replies..."

# 1. Verificar container
echo "1. Verificando container..."
docker ps | grep autosheets

# 2. Verificar cache
echo "2. Verificando cache..."
docker exec autosheets-app-1 ls -la /.bet-cache.json
echo "Conteúdo do cache:"
docker exec autosheets-app-1 cat /.bet-cache.json

# 3. Simular webhook de reply
echo "3. Simulando webhook de reply..."
curl -X POST http://localhost:3000/api/telegram/webhook   -H "Content-Type: application/json"   -d '{
    "message": {
      "message_id": 999,
      "from": {
        "id": 123456789,
        "first_name": "Test"
      },
      "chat": {
        "id": 123456789,
        "type": "private"
      },
      "text": "1.85",
      "reply_to_message": {
        "message_id": 888
      }
    }
  }'

# 4. Verificar logs após teste
echo "4. Verificando logs após teste..."
docker logs autosheets-app-1 --tail=20
