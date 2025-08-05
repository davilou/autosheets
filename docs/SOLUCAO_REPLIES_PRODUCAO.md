# 🔧 Solução para Replies não Funcionarem em Produção

## 🎯 Problema Identificado

Após análise detalhada, o problema dos replies não funcionarem está relacionado à **inicialização do monitor GramJS no ambiente de produção**. O sistema tem todos os componentes configurados corretamente, mas o monitor pode não estar sendo iniciado adequadamente.

## 🔍 Diagnóstico Realizado

### ✅ Componentes que Estão Funcionando:
- Webhook configurado corretamente (`https://autosheets.loudigital.shop/api/telegram/webhook`)
- Variáveis de ambiente carregadas (`.env.production`)
- Containers Docker rodando (`autosheets_app`, `autosheets_postgres`, `autosheets_redis`)
- Endpoint respondendo com status 200
- Sistema detecta apostas e envia notificações

### ❌ Problema Identificado:
- **Monitor GramJS pode não estar sendo iniciado corretamente**
- **Conexão entre monitor e webhook pode estar falhando**
- **Script `start.sh` tinha problema na sincronização de processos**

## 🛠️ Correções Implementadas

### 1. Correção do Script de Inicialização

**Arquivo:** `start.sh`

**Problema:** O script estava aguardando apenas o processo Next.js, não ambos os processos.

**Correção:**
```bash
# ANTES:
wait $NEXTJS_PID

# DEPOIS:
wait  # Aguarda ambos os processos
```

### 2. Scripts de Diagnóstico Criados

#### A. Script de Verificação do Monitor
**Arquivo:** `scripts/verificar-monitor-producao.sh`
- Verifica se o monitor GramJS está rodando
- Valida variáveis de ambiente
- Checa conexão webhook ↔ monitor
- Identifica erros na inicialização

#### B. Script de Teste de Replies
**Arquivo:** `scripts/testar-reply-producao.sh`
- Simula replies para testar o sistema
- Monitora logs em tempo real
- Executa testes completos automatizados

## 🚀 Próximos Passos (Execute no Servidor)

### 1. Conectar ao Servidor via SSH
```bash
ssh usuario@servidor
cd /caminho/para/autosheets
```

### 2. Aplicar a Correção do start.sh
```bash
# Parar os containers
docker compose -f docker-compose.prod.yml down

# Reconstruir com a correção
docker compose -f docker-compose.prod.yml up -d --build

# Aguardar inicialização (30 segundos)
sleep 30
```

### 3. Executar Diagnóstico Completo
```bash
# Tornar o script executável
chmod +x scripts/verificar-monitor-producao.sh

# Executar diagnóstico
./scripts/verificar-monitor-producao.sh
```

### 4. Testar o Sistema de Replies
```bash
# Tornar o script executável
chmod +x scripts/testar-reply-producao.sh

# Executar teste
./scripts/testar-reply-producao.sh
# Escolha a opção 4 (teste completo)
```

### 5. Monitorar Logs em Tempo Real
```bash
# Terminal 1: Logs gerais
docker compose -f docker-compose.prod.yml logs -f autosheets

# Terminal 2: Logs filtrados para replies
docker compose -f docker-compose.prod.yml logs -f autosheets | grep -E "(reply|betKey|Debug|processamento|GramJS|Monitor)"
```

## 🧪 Teste Real do Sistema

### Após aplicar as correções:

1. **Envie uma mensagem de aposta** em um grupo monitorado
2. **Aguarde a notificação privada** do bot
3. **Responda à notificação** com uma odd (ex: "1.85")
4. **Verifique os logs** para confirmar o processamento

### Logs Esperados (Sucesso):
```
🔍 Debug da chave:
- userId: 670237902
- repliedMessageId: 123
- betKey: 670237902_123
💰 Processando resposta à notificação...
✅ Aposta salva com sucesso!
```

### Logs de Problema:
```
❌ Nenhuma aposta pendente encontrada para a chave: 670237902_123
❌ Monitor GramJS não conectado
```

## 🔧 Soluções para Problemas Específicos

### Problema 1: Monitor não está rodando
```bash
# Verificar processos
docker compose -f docker-compose.prod.yml exec autosheets ps aux | grep tsx

# Se não encontrar, reiniciar
docker compose -f docker-compose.prod.yml restart autosheets
```

### Problema 2: Monitor não conectado ao webhook
```bash
# Verificar logs de conexão
docker compose -f docker-compose.prod.yml logs autosheets | grep -E "(setGramJSMonitor|conectado)"

# Se não encontrar, reiniciar
docker compose -f docker-compose.prod.yml restart autosheets
```

### Problema 3: Variáveis de ambiente
```bash
# Verificar se estão carregadas
docker compose -f docker-compose.prod.yml exec autosheets env | grep TELEGRAM

# Se estiverem vazias, verificar .env.production
```

## 📊 Checklist de Verificação

- [ ] Container `autosheets_app` está rodando
- [ ] Variáveis `TELEGRAM_*` estão configuradas
- [ ] Processo `tsx` (monitor) está rodando no container
- [ ] Logs mostram "Monitor GramJS conectado ao webhook"
- [ ] Webhook responde com status 200
- [ ] Teste de reply retorna logs de processamento

## 🎯 Resultado Esperado

Após aplicar todas as correções, o sistema deve:

1. ✅ **Detectar apostas** nos grupos monitorados
2. ✅ **Enviar notificações** privadas ao usuário
3. ✅ **Processar replies** com odds
4. ✅ **Salvar dados** no Google Sheets
5. ✅ **Confirmar recebimento** ao usuário

## 📞 Suporte

Se o problema persistir após seguir todos os passos:

1. Execute o diagnóstico completo: `./scripts/verificar-monitor-producao.sh`
2. Colete os logs: `docker compose -f docker-compose.prod.yml logs autosheets > logs-debug.txt`
3. Verifique se há erros específicos nos logs
4. Considere reiniciar completamente: `docker compose -f docker-compose.prod.yml down && docker compose -f docker-compose.prod.yml up -d --build`

---

**Última atualização:** $(date)
**Status:** Correções implementadas, aguardando teste em produção