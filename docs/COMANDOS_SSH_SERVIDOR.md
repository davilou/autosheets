# Comandos SSH para Verificar Webhook no Servidor

## ⚠️ IMPORTANTE
O projeto está rodando no **servidor**, não localmente. Todos os comandos devem ser executados via **SSH** no servidor onde a aplicação está hospedada.

## 🔐 Conectar ao Servidor

```bash
# Conectar via SSH ao servidor
ssh usuario@seu-servidor.com
# ou
ssh usuario@IP_DO_SERVIDOR
```

## 📁 Navegar para o Diretório do Projeto

```bash
# Ir para o diretório da aplicação
cd /caminho/para/autosheets
# ou onde quer que esteja o projeto no servidor
```

## 🔍 Verificar Status do Webhook

### 1. Verificar se os containers estão rodando
```bash
docker compose -f docker-compose.prod.yml ps
```

### 2. Verificar logs da aplicação
```bash
# Ver logs em tempo real
docker compose -f docker-compose.prod.yml logs -f autosheets

# Ver últimas 50 linhas dos logs
docker compose -f docker-compose.prod.yml logs autosheets --tail=50
```

### 3. Verificar status do webhook do Telegram
```bash
# Executar dentro do container
docker compose -f docker-compose.prod.yml exec autosheets npm run webhook:info
```

### 4. Testar conectividade do webhook
```bash
# Executar teste do webhook
docker compose -f docker-compose.prod.yml exec autosheets node test-webhook-reply.js
```

## 🐛 Debug de Replies

### Verificar se a aplicação está processando mensagens
```bash
# Monitorar logs em tempo real enquanto envia um reply
docker compose -f docker-compose.prod.yml logs -f autosheets | grep -E "(reply|betKey|webhook)"
```

### Verificar variáveis de ambiente
```bash
# Verificar se as variáveis estão carregadas
docker compose -f docker-compose.prod.yml exec autosheets env | grep TELEGRAM
```

### Verificar se o endpoint está respondendo
```bash
# Testar o endpoint diretamente no servidor
curl -X POST https://autosheets.loudigital.shop/api/telegram/webhook \
  -H "Content-Type: application/json" \
  -d '{"message":{"message_id":123,"text":"teste"}}'
```

## 🔧 Comandos de Troubleshooting

### Reiniciar apenas a aplicação
```bash
docker compose -f docker-compose.prod.yml restart autosheets
```

### Recriar e reiniciar todos os containers
```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

### Verificar se o webhook está acessível externamente
```bash
# Do servidor, testar se o webhook responde
curl -I https://autosheets.loudigital.shop/api/telegram/webhook
```

### Verificar logs do nginx (se aplicável)
```bash
# Se estiver usando nginx como proxy
docker compose -f docker-compose.prod.yml logs nginx
```

## 📊 Monitoramento em Tempo Real

### Para monitorar replies em tempo real:
```bash
# Terminal 1: Logs da aplicação
docker compose -f docker-compose.prod.yml logs -f autosheets

# Terminal 2: Logs filtrados para replies
docker compose -f docker-compose.prod.yml logs -f autosheets | grep -E "(reply|betKey|processamento)"
```

## ✅ Checklist de Verificação

1. **Conectar ao servidor via SSH** ✓
2. **Navegar para diretório do projeto** ✓
3. **Verificar containers rodando** ✓
4. **Verificar logs da aplicação** ✓
5. **Verificar status do webhook** ✓
6. **Testar conectividade** ✓
7. **Monitorar logs durante teste de reply** ✓

## 🚨 Sinais de Problema

- Container `autosheets` não está rodando
- Logs mostram erros de conexão
- Webhook retorna status diferente de 200
- Variáveis de ambiente não estão carregadas
- Endpoint não responde a requisições externas

## 📝 Próximos Passos

1. Execute os comandos via SSH no servidor
2. Verifique os logs durante um teste de reply
3. Identifique onde o processamento está falhando
4. Ajuste a configuração conforme necessário

---

**Lembre-se**: Todos os comandos devem ser executados no **servidor** via SSH, não localmente!