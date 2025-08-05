# 🔍 Como Verificar se o Webhook está Configurado no Servidor

## ✅ Status Atual do Seu Webhook

Baseado na verificação realizada, seu webhook está **CONFIGURADO CORRETAMENTE**:

```json
{
  "ok": true,
  "result": {
    "url": "https://autosheets.loudigital.shop/api/telegram/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "max_connections": 40,
    "ip_address": "31.97.168.36",
    "allowed_updates": ["message"]
  }
}
```

## 🛠️ Comandos para Verificar o Webhook

### 1. Verificar Status do Webhook
```bash
npm run webhook:info
```

**O que verificar:**
- ✅ `"ok": true` - Comando executado com sucesso
- ✅ `"url"` - URL correta do webhook
- ✅ `"pending_update_count": 0` - Sem updates pendentes
- ✅ `"allowed_updates": ["message"]` - Configurado para receber mensagens

### 2. Testar Conectividade do Webhook
```bash
node test-webhook-reply.js
```

**O que verificar:**
- ✅ `📡 Status: 200` - Servidor respondendo
- ✅ `📄 Response: {"ok":true}` - Endpoint funcionando
- ✅ Headers corretos de CORS

### 3. Verificar se a Aplicação está Rodando
```bash
# Para ambiente Docker
docker-compose -f docker-compose.prod.yml ps

# Ver logs em tempo real
docker-compose -f docker-compose.prod.yml logs -f autosheets
```

## 🔍 Verificações Detalhadas

### ✅ 1. Webhook Configurado no Telegram
- **URL:** `https://autosheets.loudigital.shop/api/telegram/webhook`
- **Status:** Ativo
- **Updates Pendentes:** 0
- **IP:** `31.97.168.36`

### ✅ 2. Endpoint Respondendo
- **Status HTTP:** 200 OK
- **Content-Type:** `application/json`
- **CORS:** Configurado para `https://api.telegram.org`
- **Response:** `{"ok":true}`

### ✅ 3. Configuração de Ambiente
- **Bot Token:** Configurado
- **Webhook URL:** Configurada
- **User ID:** Configurado (670237902)

## 🚨 Sinais de Problemas

### ❌ Webhook NÃO Configurado
```json
{
  "ok": true,
  "result": {
    "url": "",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

### ❌ Webhook com Erro
```json
{
  "ok": true,
  "result": {
    "url": "https://seu-webhook.com/api/telegram/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 15,
    "last_error_date": 1754407017,
    "last_error_message": "Wrong response from the webhook: 503 Service Unavailable"
  }
}
```

### ❌ Teste de Conectividade Falhando
```
❌ Erro na requisição: connect ECONNREFUSED
📡 Status: 503
❌ Webhook retornou erro: 503
```

## 🔧 Comandos de Troubleshooting

### Se o webhook não estiver configurado:
```bash
npm run webhook:set
```

### Se houver updates pendentes:
```bash
npm run webhook:delete
npm run webhook:set
```

### Se o endpoint não responder:
```bash
# Verificar se aplicação está rodando
docker-compose -f docker-compose.prod.yml ps

# Reiniciar aplicação
docker-compose -f docker-compose.prod.yml restart autosheets
```

## 📊 Checklist de Verificação

- [ ] **Webhook configurado no Telegram**
  ```bash
  npm run webhook:info
  ```

- [ ] **URL correta**
  - Deve ser: `https://autosheets.loudigital.shop/api/telegram/webhook`

- [ ] **Sem updates pendentes**
  - `pending_update_count` deve ser 0

- [ ] **Endpoint respondendo**
  ```bash
  node test-webhook-reply.js
  ```

- [ ] **Status 200**
  - Teste deve retornar `📡 Status: 200`

- [ ] **Aplicação rodando**
  ```bash
  docker-compose -f docker-compose.prod.yml ps
  ```

- [ ] **Logs sem erros**
  ```bash
  docker-compose -f docker-compose.prod.yml logs autosheets
  ```

## 🎯 Teste Real

Para confirmar que tudo está funcionando:

1. **Envie uma mensagem de aposta** em um grupo monitorado
2. **Aguarde a notificação privada** do bot
3. **Responda com uma odd** (ex: "1.85")
4. **Verifique os logs** para confirmar processamento:

```bash
docker-compose -f docker-compose.prod.yml logs -f autosheets | grep -E "(webhook|reply|betKey)"
```

## 📝 Logs Esperados

Quando um reply for processado, você deve ver:

```
🔄 Webhook recebido
📦 Update recebido: {...}
🔍 Tipo de update: {
  hasMessage: true,
  hasText: true,
  hasReplyTo: true,
  chatId: 670237902,
  userId: 670237902,
  messageText: "1.85"
}
📨 Mensagem de 670237902: "1.85"
🔍 Debug da chave:
- chatId: 670237902
- userId: 670237902
- repliedMessageId: 386
- betKey: 670237902_386
💰 Processando resposta à notificação...
```

## ✅ Resumo do Status

**Seu webhook está FUNCIONANDO corretamente:**
- ✅ Configurado no Telegram
- ✅ URL correta
- ✅ Endpoint respondendo (Status 200)
- ✅ Sem updates pendentes
- ✅ Pronto para receber replies

**Próximo passo:** Teste com um reply real no Telegram!