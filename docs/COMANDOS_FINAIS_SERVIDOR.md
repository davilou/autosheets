# 🎯 COMANDOS FINAIS - Execução no Servidor

## 📊 Status Atual: SSL Resolvido, Sistema Operacional

### ✅ **PROBLEMA RESOLVIDO:**
- Nginx funcionando (webhook código 405)
- Monitor GramJS conectado e detectando apostas
- Cache salvando dados corretamente
- Sistema pronto para processar replies

## 🚀 EXECUÇÃO IMEDIATA NO SERVIDOR

### 1. **Conectar ao Servidor:**
```bash
ssh root@165.227.196.173
cd /root/autosheets
```

### 2. **Dar Permissões aos Scripts:**
```bash
chmod +x scripts/teste-completo-final.sh
chmod +x scripts/testar-webhook-manual.sh
chmod +x scripts/corrigir-nginx.sh
```

### 3. **EXECUTAR TESTE COMPLETO (RECOMENDADO):**
```bash
./scripts/teste-completo-final.sh
```

**Este script faz tudo:**
- ✅ Verifica infraestrutura (Docker, Nginx)
- ✅ Testa conectividade do webhook
- ✅ Analisa cache de apostas
- ✅ Executa teste manual de reply
- ✅ Monitora logs em tempo real
- ✅ Gera relatório final

### 4. **Alternativa - Teste Manual Específico:**
```bash
./scripts/testar-webhook-manual.sh
```

## 📱 TESTE REAL NO TELEGRAM

### Após executar os scripts, teste no Telegram:

1. **Acesse o chat privado com o bot**
2. **Encontre a última mensagem de aposta** (ex: "GSC Liebenfels vs SGA Sirnitz")
3. **Responda com uma odd:** `1.85` ou `0`
4. **Aguarde confirmação do bot**

## 📊 MONITORAMENTO EM TEMPO REAL

### Para acompanhar o processamento:
```bash
# Logs gerais
docker compose -f docker-compose.prod.yml logs -f autosheets

# Logs específicos de replies
docker compose -f docker-compose.prod.yml logs -f autosheets | grep -E "(💰|reply|betKey|Processando)"

# Status dos serviços
watch -n 5 'docker compose -f docker-compose.prod.yml ps'

# Verificar cache
cat .bet-cache.json | jq .
```

## 🎯 INDICADORES DE SUCESSO

### ✅ **Sistema Funcionando - Você verá:**
```
💰 Processando reply de odd...
[CACHE] Buscando aposta com chave: 670237902_402
✅ Aposta encontrada no cache
📊 Salvando no Google Sheets...
✅ Dados salvos com sucesso
🗑️ Removendo aposta do cache
```

### ❌ **Se ainda houver problemas:**
```
❌ Nenhuma aposta pendente encontrada para chave: 670237902_402
```

## 🔧 COMANDOS DE EMERGÊNCIA

### Se algo der errado:
```bash
# Reiniciar todos os serviços
docker compose -f docker-compose.prod.yml restart

# Verificar logs de erro
docker compose -f docker-compose.prod.yml logs autosheets | grep -i error

# Recriar contêineres
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d

# Verificar conectividade
curl -I https://autosheets.loudigital.shop/api/telegram/webhook
```

## 📋 CHECKLIST DE EXECUÇÃO

### Execute na ordem:

- [ ] **1. Conectar ao servidor**
- [ ] **2. Dar permissões aos scripts**
- [ ] **3. Executar `./scripts/teste-completo-final.sh`**
- [ ] **4. Analisar relatório do teste**
- [ ] **5. Se OK: Testar no Telegram**
- [ ] **6. Monitorar logs durante teste real**
- [ ] **7. Verificar se aposta foi processada**

## 🎯 RESULTADO ESPERADO

### Após a execução bem-sucedida:

1. **✅ Webhook respondendo (código 405)**
2. **✅ Cache com apostas detectadas**
3. **✅ Teste manual processando replies**
4. **✅ Logs mostrando processamento**
5. **✅ Apostas sendo removidas do cache**
6. **✅ Dados salvos no Google Sheets**

## 📞 SUPORTE

### Se precisar de ajuda:

1. **Execute o teste completo primeiro**
2. **Copie os logs do relatório**
3. **Teste no Telegram**
4. **Monitore os logs em tempo real**
5. **Documente qualquer erro encontrado**

---

## 🚀 COMANDO PRINCIPAL PARA EXECUTAR AGORA:

```bash
ssh root@165.227.196.173
cd /root/autosheets
chmod +x scripts/teste-completo-final.sh
./scripts/teste-completo-final.sh
```

**Este comando resolve tudo e gera um relatório completo do sistema!**