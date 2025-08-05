# 🎯 COMANDOS PARA TESTAR DIRETAMENTE NO SERVIDOR

## 📋 Execute estes comandos no seu servidor SSH

### 1. **Conectar ao Servidor:**
```bash
ssh root@165.227.196.173
cd /root/autosheets
```

### 2. **Verificar Cache de Apostas:**
```bash
# Verificar se o cache existe e seu conteúdo
ls -la .bet-cache.json
cat .bet-cache.json | jq .

# Se não tiver jq instalado, use:
cat .bet-cache.json
```

### 3. **Verificar Status dos Serviços:**
```bash
docker compose -f docker-compose.prod.yml ps
```

### 4. **Testar Webhook Manualmente:**
```bash
# Primeiro, pegue uma chave do cache
BET_KEY=$(cat .bet-cache.json | jq -r 'keys[0]' 2>/dev/null)
echo "Chave encontrada: $BET_KEY"

# Extrair userId e messageId
USER_ID=$(echo "$BET_KEY" | cut -d'_' -f1)
MESSAGE_ID=$(echo "$BET_KEY" | cut -d'_' -f2)

echo "User ID: $USER_ID"
echo "Message ID: $MESSAGE_ID"
```

### 5. **Simular Reply do Telegram:**
```bash
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

# Verificar o payload criado
cat test_payload.json | jq .
```

### 6. **Enviar para o Webhook:**
```bash
# Enviar o payload para o webhook
curl -X POST \
  -H "Content-Type: application/json" \
  -d @test_payload.json \
  https://autosheets.loudigital.shop/api/telegram/webhook

echo "\nPayload enviado!"
```

### 7. **Monitorar Logs em Tempo Real:**
```bash
# Em um terminal separado, monitore os logs
docker compose -f docker-compose.prod.yml logs -f autosheets | grep -E "(💰|reply|betKey|Processando|cache|✅|❌)"
```

### 8. **Verificar se a Aposta foi Processada:**
```bash
# Aguardar 3 segundos e verificar o cache novamente
sleep 3
echo "Cache após processamento:"
cat .bet-cache.json | jq .

# Verificar se a chave foi removida
if cat .bet-cache.json | jq -e ".\"$BET_KEY\"" >/dev/null 2>&1; then
    echo "❌ Aposta ainda está no cache - não foi processada"
else
    echo "✅ Aposta removida do cache - processamento bem-sucedido!"
fi
```

## 🔍 SCRIPT COMPLETO PARA COPIAR E COLAR:

```bash
# ===== TESTE COMPLETO DO SISTEMA DE REPLIES =====
echo "🚀 Iniciando teste do sistema de replies..."

# Verificar cache
echo "📊 Verificando cache..."
if [ -f ".bet-cache.json" ]; then
    echo "✅ Cache encontrado"
    cat .bet-cache.json | jq . 2>/dev/null || cat .bet-cache.json
    
    # Pegar primeira chave
    BET_KEY=$(cat .bet-cache.json | jq -r 'keys[0]' 2>/dev/null)
    if [ "$BET_KEY" != "null" ] && [ "$BET_KEY" != "" ]; then
        echo "🔑 Chave de teste: $BET_KEY"
        
        # Extrair dados
        USER_ID=$(echo "$BET_KEY" | cut -d'_' -f1)
        MESSAGE_ID=$(echo "$BET_KEY" | cut -d'_' -f2)
        
        echo "👤 User ID: $USER_ID"
        echo "📨 Message ID: $MESSAGE_ID"
        
        # Criar payload
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
        response=$(curl -s -X POST \
            -H "Content-Type: application/json" \
            -d @test_payload.json \
            https://autosheets.loudigital.shop/api/telegram/webhook)
        
        echo "📥 Resposta: $response"
        
        echo "⏳ Aguardando 5 segundos para processamento..."
        sleep 5
        
        echo "🔍 Verificando resultado..."
        if [ -f ".bet-cache.json" ]; then
            if cat .bet-cache.json | jq -e ".\"$BET_KEY\"" >/dev/null 2>&1; then
                echo "❌ Aposta ainda está no cache - pode não ter sido processada"
                echo "📋 Cache atual:"
                cat .bet-cache.json | jq . 2>/dev/null || cat .bet-cache.json
            else
                echo "✅ Aposta removida do cache - processamento bem-sucedido!"
            fi
        fi
        
        # Limpar arquivo temporário
        rm -f test_payload.json
        
    else
        echo "❌ Nenhuma chave válida encontrada no cache"
    fi
else
    echo "❌ Cache não encontrado"
fi

echo "🏁 Teste concluído!"
```

## 📊 COMANDOS DE MONITORAMENTO CONTÍNUO:

### Para acompanhar em tempo real:
```bash
# Logs gerais
docker compose -f docker-compose.prod.yml logs -f autosheets

# Logs específicos de replies
docker compose -f docker-compose.prod.yml logs -f autosheets | grep -E "(💰|reply|betKey|Processando)"

# Status dos serviços
watch -n 5 'docker compose -f docker-compose.prod.yml ps'

# Webhook status
curl -I https://autosheets.loudigital.shop/api/telegram/webhook
```

## 🎯 INDICADORES DE SUCESSO:

### ✅ **Se estiver funcionando, você verá nos logs:**
```
💰 Processando reply de odd...
[CACHE] Buscando aposta com chave: 670237902_404
✅ Aposta encontrada no cache
📊 Salvando no Google Sheets...
✅ Dados salvos com sucesso
🗑️ Removendo aposta do cache
```

### ❌ **Se houver problemas:**
```
❌ Nenhuma aposta pendente encontrada para chave: 670237902_404
```

## 🚨 TESTE REAL NO TELEGRAM:

Após o teste manual, faça o teste real:
1. Acesse o chat privado com o bot
2. Responda à mensagem da aposta `GSC Liebenfels vs SGA Sirnitz`
3. Digite uma odd (ex: `1.85`)
4. Monitore os logs para ver o processamento

---

**Execute o script completo acima para testar todo o sistema de uma vez!**

## 🔧 Scripts Adicionais para Diagnóstico

### Localizar Cache no Servidor
```bash
# Dar permissão e executar script de localização
chmod +x scripts/localizar-cache-servidor.sh
./scripts/localizar-cache-servidor.sh
```

### Teste Completo no Container
```bash
# Script que testa diretamente no container Docker
chmod +x scripts/teste-reply-container.sh
./scripts/teste-reply-container.sh
```

### Script de Debug Detalhado do Webhook
```bash
# Diagnóstico completo com logs em tempo real
chmod +x scripts/debug-webhook-reply.sh
./scripts/debug-webhook-reply.sh
```

### Script para Testar Detecção de Reply
```bash
# Testa diferentes formatos de payload
chmod +x scripts/testar-deteccao-reply.sh
./scripts/testar-deteccao-reply.sh
```

### Scripts de Teste Específicos dos Logs
```bash
# Teste específico dos logs do webhook
chmod +x scripts/testar-logs-webhook.sh
./scripts/testar-logs-webhook.sh
```

### Debug da Estrutura do Payload
```bash
# Debug da estrutura do payload
chmod +x scripts/debug-payload-estrutura.sh
./scripts/debug-payload-estrutura.sh
```

### Monitoramento em Tempo Real
```bash
# Em um terminal separado, monitore os logs
docker compose -f docker-compose.prod.yml logs -f autosheets_app | grep -E "(💰|reply|betKey|Processando|cache|✅|❌|webhook)"
```

## 🏁 Conclusão

Após executar estes comandos, você terá:
- ✅ Localizado onde o cache está sendo salvo (host vs container)
- ✅ Verificado se o cache existe e contém apostas
- ✅ Testado o processamento de replies via webhook no ambiente correto
- ✅ Confirmado se as apostas são removidas após processamento
- ✅ Monitorado os logs para validar o funcionamento

Se tudo funcionar corretamente, o sistema de replies estará operacional! 🎉