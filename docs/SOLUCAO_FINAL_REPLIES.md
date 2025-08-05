# 🔧 SOLUÇÃO FINAL - PROBLEMA DE REPLIES

## 📊 Análise dos Logs

Baseado nos logs fornecidos, identificamos:

### ✅ O que está funcionando:
- Monitor GramJS conectado ao webhook
- Apostas sendo detectadas e salvas no cache
- Cache contém apostas pendentes
- Aplicação rodando corretamente

### ❌ O que não está funcionando:
- Replies não estão sendo processados pelo webhook
- Comando `autosheets_app` não existe (serviço se chama `autosheets`)
- Webhook pode não estar recebendo os requests do Telegram

## 🔍 Diagnóstico Detalhado

### 1. Execute o diagnóstico completo:
```bash
chmod +x scripts/diagnostico-reply-final.sh
./scripts/diagnostico-reply-final.sh
```

### 2. Teste manual do webhook:
```bash
chmod +x scripts/testar-webhook-manual.sh
./scripts/testar-webhook-manual.sh
```

## 🎯 Possíveis Causas do Problema

### 1. **Webhook não configurado no Telegram**
- O Telegram pode não estar enviando os updates para o webhook
- Verificar se o webhook está registrado corretamente

### 2. **Problema de conectividade**
- Nginx pode não estar roteando corretamente
- SSL/HTTPS pode ter problemas

### 3. **Problema na geração da betKey**
- A chave gerada no monitor pode não coincidir com a do webhook
- Diferença entre `yourUserId` e `userId` do reply

### 4. **Problema no processamento do webhook**
- Monitor conectado mas não sincronizado
- Cache compartilhado não funcionando corretamente

## 🛠️ Soluções Propostas

### Solução 1: Verificar Webhook do Telegram
```bash
# Verificar se o webhook está configurado
curl -X GET "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"

# Reconfigurar webhook se necessário
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://autosheets.loudigital.com.br/api/telegram/webhook"}'
```

### Solução 2: Verificar Logs em Tempo Real
```bash
# Monitorar logs enquanto testa reply
docker compose -f docker-compose.prod.yml logs -f autosheets | grep -E "(webhook|reply|POST|💰|betKey|CACHE)"
```

### Solução 3: Teste Manual Completo
```bash
# 1. Verificar cache atual
docker compose -f docker-compose.prod.yml exec autosheets cat .bet-cache.json

# 2. Enviar reply manual via Telegram
# 3. Verificar logs imediatamente
# 4. Verificar se cache foi atualizado
```

### Solução 4: Reiniciar Serviços
```bash
# Reiniciar aplicação
docker compose -f docker-compose.prod.yml restart autosheets

# Verificar se reconectou
docker compose -f docker-compose.prod.yml logs autosheets | grep "Monitor GramJS conectado"
```

## 🧪 Teste Passo a Passo

### 1. **Preparação**
```bash
# Limpar logs antigos
docker compose -f docker-compose.prod.yml logs autosheets --tail=0

# Verificar cache atual
docker compose -f docker-compose.prod.yml exec autosheets cat .bet-cache.json
```

### 2. **Monitoramento**
```bash
# Em um terminal, monitorar logs
docker compose -f docker-compose.prod.yml logs -f autosheets
```

### 3. **Teste Real**
- Enviar uma aposta no grupo monitorado
- Aguardar notificação privada
- Responder com uma odd (ex: 1.85)
- Verificar logs em tempo real

### 4. **Verificação**
```bash
# Verificar se foi processado
docker compose -f docker-compose.prod.yml exec autosheets cat .bet-cache.json

# Verificar planilha Google Sheets
```

## 🔧 Comandos de Emergência

### Se nada funcionar:
```bash
# 1. Parar tudo
docker compose -f docker-compose.prod.yml down

# 2. Limpar cache
rm -f .bet-cache.json

# 3. Reiniciar
docker compose -f docker-compose.prod.yml up -d

# 4. Verificar logs
docker compose -f docker-compose.prod.yml logs -f autosheets
```

## 📋 Checklist de Verificação

- [ ] Webhook configurado no Telegram
- [ ] Aplicação respondendo na porta correta
- [ ] Monitor GramJS conectado
- [ ] Cache sendo criado e lido
- [ ] Logs de webhook aparecendo
- [ ] BetKey sendo gerada corretamente
- [ ] Reply sendo processado
- [ ] Dados salvos na planilha

## 🆘 Se Ainda Não Funcionar

1. **Verificar variáveis de ambiente**
2. **Testar webhook manualmente com curl**
3. **Verificar conectividade HTTPS**
4. **Analisar logs do nginx**
5. **Verificar se o bot tem permissões corretas**

## 📞 Próximos Passos

1. Execute o diagnóstico completo
2. Execute o teste manual
3. Compartilhe os resultados para análise mais detalhada
4. Se necessário, implementaremos correções adicionais