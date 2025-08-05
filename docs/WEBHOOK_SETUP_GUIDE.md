# Guia de Configuração do Webhook - Sistema de Replies

## Problema Identificado

O sistema não está capturando as respostas dos usuários porque **o bot do Telegram não está configurado para usar webhook**. Atualmente:

1. ✅ **GramJS Monitor** - Funciona corretamente (monitora grupos e envia notificações)
2. ✅ **Webhook Endpoint** - Existe e está configurado (`/api/telegram/webhook`)
3. ❌ **Bot Webhook** - **NÃO está configurado** para enviar updates para o webhook

## Fluxo Atual vs. Fluxo Esperado

### 🔴 Fluxo Atual (Quebrado)
```
Grupo → GramJS Monitor → Notificação Privada → Usuário Responde → ❌ NADA ACONTECE
```

### ✅ Fluxo Esperado (Correto)
```
Grupo → GramJS Monitor → Notificação Privada → Usuário Responde → Webhook → Processamento
```

## Solução

### 1. Configurar Variáveis de Ambiente

Crie o arquivo `.env.local` baseado no `.env.local.example`:

```bash
cp .env.local.example .env.local
```

Preencha as variáveis necessárias:
- `TELEGRAM_BOT_TOKEN` - Token do seu bot
- `WEBHOOK_URL` - URL pública do seu webhook
- Outras variáveis conforme necessário

### 2. Configurar o Webhook do Bot

```bash
# Verificar status atual
npm run webhook:info

# Configurar webhook
npm run webhook:set

# Verificar se foi configurado
npm run webhook:info
```

### 3. Verificar Configuração

Após configurar o webhook, você deve ver algo como:

```json
{
  "ok": true,
  "result": {
    "url": "https://your-domain.com/api/telegram/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "allowed_updates": ["message"]
  }
}
```

## Comandos Disponíveis

```bash
# Configurar webhook
npm run webhook:set

# Remover webhook (volta para polling)
npm run webhook:delete

# Ver informações do webhook
npm run webhook:info
```

## Variáveis de Ambiente Necessárias

### Obrigatórias para Webhook
- `TELEGRAM_BOT_TOKEN` - Token do bot do Telegram
- `WEBHOOK_URL` - URL pública do webhook (ex: `https://seu-dominio.com/api/telegram/webhook`)

### Outras Variáveis Importantes
- `YOUR_USER_ID` - Seu ID de usuário no Telegram
- `MONITORED_CHAT_IDS` - IDs dos grupos monitorados
- `GEMINI_API_KEY` - Para análise de apostas
- `GOOGLE_SHEETS_ID` - Para salvar dados

## Troubleshooting

### Problema: "TELEGRAM_BOT_TOKEN não configurado!"
**Solução:** Configure a variável no `.env.local`

### Problema: "Webhook URL inválida"
**Solução:** 
- Certifique-se que a URL é HTTPS
- Verifique se o domínio está acessível publicamente
- Teste a URL manualmente

### Problema: "Pending updates"
**Solução:** Execute `npm run webhook:set` (limpa updates pendentes automaticamente)

### Problema: Webhook configurado mas replies não funcionam
**Verificações:**
1. Webhook está ativo? → `npm run webhook:info`
2. Aplicação está rodando na URL configurada?
3. Logs do webhook aparecem quando você envia mensagem?
4. Chaves betKey estão sendo geradas corretamente?

## Logs de Debug

Quando funcionando corretamente, você deve ver:

```
🔄 Webhook recebido
📦 Update recebido: {...}
🔍 Tipo de update: {
  hasMessage: true,
  hasText: true,
  hasReplyTo: true,
  chatId: 123456789,
  userId: 123456789,
  messageText: "1.8"
}
📨 Mensagem de 123456789: "1.8"
🔍 Debug da chave:
- chatId: 123456789
- userId: 123456789
- repliedMessageId: 456
- betKey: 123456789_456
💰 Processando resposta à notificação...
```

## Próximos Passos

1. ✅ Configure as variáveis de ambiente
2. ✅ Execute `npm run webhook:set`
3. ✅ Teste o fluxo completo
4. ✅ Monitore os logs para verificar funcionamento

## Arquivos Relacionados

- `src/scripts/setup-webhook.ts` - Script de configuração do webhook
- `src/app/api/telegram/webhook/route.ts` - Endpoint do webhook
- `src/lib/telegram/gramjs-monitor.ts` - Monitor do GramJS
- `.env.local.example` - Exemplo de variáveis de ambiente