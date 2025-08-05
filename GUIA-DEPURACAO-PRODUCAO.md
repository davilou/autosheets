# 🔍 GUIA COMPLETO DE DEPURAÇÃO - PROBLEMA DE REPLIES EM PRODUÇÃO

## 📊 DIAGNÓSTICO REALIZADO

Após executar os scripts de diagnóstico, identificamos que:

✅ **Webhook está configurado corretamente**
✅ **Aplicação está respondendo**
❌ **Replies não estão sendo processados (cache vazio)**

## 🎯 PROBLEMA IDENTIFICADO

O webhook está funcionando, mas as **apostas não estão sendo encontradas no cache** quando o usuário responde. Isso indica que o problema está em uma dessas áreas:

1. **Monitor GramJS não está detectando apostas**
2. **Cache não está sendo compartilhado entre processos**
3. **Chaves betKey estão sendo geradas incorretamente**
4. **Variáveis de ambiente incorretas**

## 🔧 COMANDOS DE DEPURAÇÃO (EXECUTE NO SERVIDOR)

### 1. Verificar Status dos Containers
```bash
# Verificar se todos os containers estão rodando
docker-compose -f docker-compose.prod.yml ps

# Deve mostrar:
# - autosheets (aplicação principal)
# - gramjs-monitor (monitor do Telegram)
# - outros containers (nginx, redis, etc.)
```

### 2. Verificar Logs do Monitor GramJS
```bash
# Ver logs recentes do monitor
docker-compose -f docker-compose.prod.yml logs gramjs-monitor | tail -30

# Ver logs em tempo real
docker-compose -f docker-compose.prod.yml logs -f gramjs-monitor
```

**O que procurar:**
- ✅ "Monitor conectado"
- ✅ "Detectada aposta em..."
- ❌ Erros de conexão
- ❌ "Não foi possível conectar"

### 3. Verificar Cache de Apostas
```bash
# Verificar se o arquivo de cache existe
docker-compose -f docker-compose.prod.yml exec autosheets ls -la .bet-cache.json

# Ver conteúdo do cache
docker-compose -f docker-compose.prod.yml exec autosheets cat .bet-cache.json

# Ver cache formatado (se jq estiver disponível)
docker-compose -f docker-compose.prod.yml exec autosheets cat .bet-cache.json | jq .
```

**O que procurar:**
- ✅ Arquivo existe e tem conteúdo
- ✅ Apostas recentes no cache
- ❌ Arquivo vazio `{}`
- ❌ Arquivo não existe

### 4. Verificar Logs de Webhook
```bash
# Ver logs de webhook recentes
docker-compose -f docker-compose.prod.yml logs autosheets | grep -E "(webhook|reply|betKey)" | tail -20

# Ver logs em tempo real
docker-compose -f docker-compose.prod.yml logs -f autosheets | grep -E "(webhook|reply|betKey)"
```

### 5. Verificar Variáveis de Ambiente
```bash
# Verificar variáveis críticas
docker-compose -f docker-compose.prod.yml exec autosheets env | grep -E "(TELEGRAM|YOUR_USER_ID|MONITORED_CHAT_IDS)"
```

**Variáveis críticas:**
- `YOUR_USER_ID` - Deve ser seu ID do Telegram
- `MONITORED_CHAT_IDS` - IDs dos chats monitorados
- `TELEGRAM_API_ID` e `TELEGRAM_API_HASH` - Credenciais da API
- `TELEGRAM_SESSION_STRING` - String de sessão do GramJS

### 6. Testar Conectividade Redis (se usado)
```bash
# Testar conexão com Redis
docker-compose -f docker-compose.prod.yml exec autosheets node -e "const Redis = require('ioredis'); const redis = new Redis(process.env.REDIS_URL); redis.ping().then(console.log).catch(console.error);"
```

## 🚨 PROBLEMAS MAIS COMUNS E SOLUÇÕES

### Problema 1: Monitor GramJS não está rodando
**Sintomas:**
- Container `gramjs-monitor` não aparece em `docker ps`
- Logs mostram erro de inicialização

**Solução:**
```bash
# Reiniciar o monitor
docker-compose -f docker-compose.prod.yml restart gramjs-monitor

# Ver logs para identificar erro
docker-compose -f docker-compose.prod.yml logs gramjs-monitor
```

### Problema 2: Monitor não está conectado
**Sintomas:**
- Monitor roda mas não detecta mensagens
- Logs mostram "Não foi possível conectar"

**Solução:**
```bash
# Verificar variáveis de ambiente
docker-compose -f docker-compose.prod.yml exec gramjs-monitor env | grep TELEGRAM

# Recriar sessão se necessário
# (pode precisar gerar nova TELEGRAM_SESSION_STRING)
```

### Problema 3: Cache vazio
**Sintomas:**
- Monitor detecta apostas mas cache está vazio
- Arquivo `.bet-cache.json` existe mas é `{}`

**Solução:**
```bash
# Verificar permissões do arquivo
docker-compose -f docker-compose.prod.yml exec autosheets ls -la .bet-cache.json

# Verificar se o monitor tem acesso ao mesmo arquivo
docker-compose -f docker-compose.prod.yml exec gramjs-monitor ls -la .bet-cache.json
```

### Problema 4: MONITORED_CHAT_IDS incorreto
**Sintomas:**
- Monitor conecta mas não detecta apostas
- Logs não mostram "Detectada aposta"

**Solução:**
```bash
# Verificar IDs dos chats
docker-compose -f docker-compose.prod.yml exec autosheets env | grep MONITORED_CHAT_IDS

# Deve conter os IDs dos chats onde apostas são postadas
# Formato: "chat1,chat2,chat3" ou "[chat1,chat2,chat3]"
```

### Problema 5: Chave betKey incorreta
**Sintomas:**
- Apostas são detectadas e salvas
- Replies não são processados
- Logs mostram "Aposta não encontrada para chave X"

**Solução:**
- Verificar se a geração da chave está consistente
- Formato deve ser: `${userId}_${messageId}`

## 🔄 COMANDOS DE CORREÇÃO RÁPIDA

### Reiniciar Tudo
```bash
# Reiniciar todos os containers
docker-compose -f docker-compose.prod.yml restart

# Aguardar e verificar status
sleep 10
docker-compose -f docker-compose.prod.yml ps
```

### Reconfigurar Webhook
```bash
# Deletar e recriar webhook
npm run webhook:delete
npm run webhook:set

# Verificar configuração
npm run webhook:info
```

### Limpar Cache e Reiniciar
```bash
# Parar containers
docker-compose -f docker-compose.prod.yml down

# Remover cache antigo
rm -f .bet-cache.json

# Reiniciar
docker-compose -f docker-compose.prod.yml up -d
```

## 📝 TESTE MANUAL APÓS CORREÇÕES

1. **Verificar se monitor está detectando:**
   ```bash
   docker-compose -f docker-compose.prod.yml logs -f gramjs-monitor
   ```
   - Envie uma mensagem no chat monitorado
   - Deve aparecer "Detectada aposta" nos logs

2. **Verificar se aposta foi salva no cache:**
   ```bash
   docker-compose -f docker-compose.prod.yml exec autosheets cat .bet-cache.json
   ```
   - Deve mostrar a aposta recém-detectada

3. **Testar reply:**
   - Responda à mensagem com uma odd (ex: "1.85")
   - Verificar logs do webhook:
   ```bash
   docker-compose -f docker-compose.prod.yml logs autosheets | grep -E "(reply|betKey|processado)"
   ```

## 🎯 PRÓXIMOS PASSOS

1. **Execute os comandos de verificação na ordem**
2. **Identifique qual componente está falhando**
3. **Aplique a solução correspondente**
4. **Teste manualmente**
5. **Se ainda não funcionar, verifique logs detalhados**

## 📞 SUPORTE ADICIONAL

Se após seguir este guia o problema persistir, colete as seguintes informações:

1. Saída de `docker-compose -f docker-compose.prod.yml ps`
2. Logs do monitor: `docker-compose -f docker-compose.prod.yml logs gramjs-monitor`
3. Conteúdo do cache: `cat .bet-cache.json`
4. Variáveis de ambiente (sem expor tokens): `env | grep TELEGRAM`
5. Logs de webhook dos últimos 50 replies testados

---

**💡 Dica:** O problema mais comum é o monitor GramJS não estar detectando apostas devido a `MONITORED_CHAT_IDS` incorreto ou sessão expirada.