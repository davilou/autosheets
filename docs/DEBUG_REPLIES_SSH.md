# 🐛 Debug de Replies via SSH - Guia Rápido

## 🚨 Problema Atual
**Sintoma**: Após fazer um reply no Telegram, nada acontece.
**Causa Provável**: Webhook configurado mas aplicação não está processando as mensagens corretamente.

## 🔧 Comandos Essenciais (Execute via SSH)

### 1. Conectar ao Servidor
```bash
ssh usuario@seu-servidor.com
cd /caminho/para/autosheets
```

### 2. Verificação Rápida
```bash
# Verificar se containers estão rodando
docker-compose -f docker-compose.prod.yml ps

# Se autosheets não estiver UP, iniciar:
docker-compose -f docker-compose.prod.yml up -d autosheets
```

### 3. Monitorar Logs em Tempo Real
```bash
# Abrir logs em tempo real ANTES de fazer o teste
docker-compose -f docker-compose.prod.yml logs -f autosheets
```

### 4. Teste de Reply (Em outro terminal SSH)
```bash
# Terminal 2: Executar teste enquanto monitora logs
docker-compose -f docker-compose.prod.yml exec autosheets node test-webhook-reply.js
```

## 🔍 Diagnóstico Completo

### Executar script de diagnóstico:
```bash
# Tornar executável
chmod +x scripts/diagnostico-servidor.sh

# Executar diagnóstico completo
./scripts/diagnostico-servidor.sh
```

## 🎯 Pontos Críticos para Verificar

### 1. Container Status
```bash
docker-compose -f docker-compose.prod.yml ps autosheets
# Deve mostrar "Up" no status
```

### 2. Webhook Status
```bash
docker-compose -f docker-compose.prod.yml exec autosheets npm run webhook:info
# Deve mostrar:
# - url: https://autosheets.loudigital.shop/api/telegram/webhook
# - pending_update_count: 0
# - last_error_message: null
```

### 3. Variáveis de Ambiente
```bash
docker-compose -f docker-compose.prod.yml exec autosheets env | grep TELEGRAM
# Deve mostrar TELEGRAM_BOT_TOKEN e outras variáveis
```

### 4. Conectividade do Endpoint
```bash
curl -X POST https://autosheets.loudigital.shop/api/telegram/webhook \
  -H "Content-Type: application/json" \
  -d '{"message":{"message_id":123,"text":"teste"}}'
# Deve retornar: {"ok":true}
```

## 🚨 Problemas Comuns e Soluções

### Problema 1: Container não está rodando
```bash
# Solução:
docker-compose -f docker-compose.prod.yml up -d autosheets
```

### Problema 2: Webhook com pending updates
```bash
# Solução:
docker-compose -f docker-compose.prod.yml exec autosheets npm run webhook:set
```

### Problema 3: Endpoint retorna 503/404
```bash
# Verificar se aplicação está respondendo:
docker-compose -f docker-compose.prod.yml logs autosheets --tail=50

# Reiniciar se necessário:
docker-compose -f docker-compose.prod.yml restart autosheets
```

### Problema 4: Logs não mostram processamento
```bash
# Verificar se as rotas estão registradas:
docker-compose -f docker-compose.prod.yml exec autosheets npm run webhook:info

# Verificar logs de inicialização:
docker-compose -f docker-compose.prod.yml logs autosheets | grep -E "(started|listening|webhook)"
```

## 🧪 Teste Passo a Passo

### 1. Preparar Monitoramento
```bash
# Terminal 1: Logs em tempo real
docker-compose -f docker-compose.prod.yml logs -f autosheets
```

### 2. Executar Teste
```bash
# Terminal 2: Teste do webhook
docker-compose -f docker-compose.prod.yml exec autosheets node test-webhook-reply.js
```

### 3. Verificar Resultado
**No Terminal 1 (logs), você deve ver:**
```
[timestamp] Webhook received: POST /api/telegram/webhook
[timestamp] Processing reply message...
[timestamp] BetKey found: 670237902_386
[timestamp] Reply processed successfully
```

**No Terminal 2, você deve ver:**
```
Testing webhook...
Status: 200
Response: {"ok":true}
BetKey found: 670237902_386
```

## 🔄 Teste Real com Telegram

### 1. Preparar Monitoramento
```bash
docker-compose -f docker-compose.prod.yml logs -f autosheets | grep -E "(reply|betKey|webhook|message)"
```

### 2. Executar Teste Real
1. Envie uma mensagem no grupo monitorado
2. Responda à mensagem
3. Observe os logs em tempo real

### 3. Resultado Esperado nos Logs
```
[timestamp] Received webhook update
[timestamp] Processing message type: reply
[timestamp] BetKey generated: [user_id]_[message_id]
[timestamp] Reply data processed and stored
```

## 📞 Comandos de Emergência

### Reiniciar Tudo
```bash
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

### Reconfigurar Webhook
```bash
docker-compose -f docker-compose.prod.yml exec autosheets npm run webhook:delete
docker-compose -f docker-compose.prod.yml exec autosheets npm run webhook:set
```

### Verificar Saúde Geral
```bash
./scripts/diagnostico-servidor.sh
```

---

**⚠️ LEMBRE-SE**: Todos os comandos devem ser executados no **servidor** via SSH, não localmente!

**🎯 OBJETIVO**: Identificar exatamente onde o processamento de replies está falhando e corrigir o problema.