# Scripts de Diagnóstico Completo - Sistema de Replies

## Visão Geral

Este documento consolida todos os scripts de diagnóstico criados para resolver o problema de replies do bot Telegram. Os scripts estão organizados por nível de diagnóstico e complexidade.

## Status Atual do Problema

### ✅ Componentes Funcionando
- Container `autosheets_app` rodando
- Monitor GramJS conectado
- Cache de apostas funcionando (`.bet-cache.json`)
- Webhook respondendo com HTTP 200
- Conectividade Redis e Database

### ❌ Problema Identificado
- **Webhook não processa replies corretamente**
- Apostas não são removidas do cache após resposta
- Logs de debug do webhook não aparecem nos testes

## Scripts de Diagnóstico

### 1. Scripts Básicos de Verificação

#### `localizar-cache-servidor.sh`
**Finalidade:** Localizar e exibir o conteúdo do cache de apostas
```bash
./scripts/localizar-cache-servidor.sh
```
**O que faz:**
- Procura o arquivo `.bet-cache.json` no sistema
- Exibe o conteúdo atual do cache
- Verifica conectividade Redis

#### `teste-reply-container.sh`
**Finalidade:** Teste básico do sistema de replies no container
```bash
./scripts/teste-reply-container.sh
```
**O que faz:**
- Verifica status dos serviços Docker
- Testa webhook com payload simples
- Verifica se aposta é removida do cache

### 2. Scripts de Debug Avançado

#### `debug-webhook-reply.sh`
**Finalidade:** Diagnóstico detalhado do processamento de replies
```bash
./scripts/debug-webhook-reply.sh
```
**O que faz:**
- Monitora logs em tempo real durante teste
- Analisa resposta do webhook
- Verifica remoção da aposta do cache
- Fornece diagnóstico completo

#### `testar-deteccao-reply.sh`
**Finalidade:** Teste específico da detecção de `reply_to_message`
```bash
./scripts/testar-deteccao-reply.sh
```
**O que faz:**
- Testa diferentes formatos de payload
- Verifica detecção de reply_to_message
- Analisa logs de processamento

### 3. Scripts de Debug Específico

#### `testar-logs-webhook.sh` ⭐ **NOVO**
**Finalidade:** Verificar se logs do webhook estão sendo gerados
```bash
./scripts/testar-logs-webhook.sh
```
**O que faz:**
- Limpa logs anteriores
- Monitora logs durante envio de payload
- Verifica se logs específicos são gerados:
  - "Update recebido"
  - "Tipo de update"
  - "Debug da chave"
  - "Processando resposta"
- Diagnóstico detalhado da execução

#### `debug-payload-estrutura.sh` ⭐ **NOVO**
**Finalidade:** Debug da estrutura do payload e detecção de reply
```bash
./scripts/debug-payload-estrutura.sh
```
**O que faz:**
- **Teste 1:** Payload sem `reply_to_message`
- **Teste 2:** Payload com `reply_to_message` básico
- **Teste 3:** Payload com `reply_to_message` completo
- Análise comparativa dos resultados
- Verificação específica da detecção de reply

## Ordem Recomendada de Execução

### Fase 1: Verificação Básica
```bash
# 1. Verificar cache e status
./scripts/localizar-cache-servidor.sh

# 2. Teste básico de reply
./scripts/teste-reply-container.sh
```

### Fase 2: Diagnóstico dos Logs
```bash
# 3. Verificar se logs estão sendo gerados
./scripts/testar-logs-webhook.sh
```

### Fase 3: Debug da Estrutura
```bash
# 4. Testar diferentes estruturas de payload
./scripts/debug-payload-estrutura.sh
```

### Fase 4: Análise Avançada (se necessário)
```bash
# 5. Debug detalhado completo
./scripts/debug-webhook-reply.sh

# 6. Teste específico de detecção
./scripts/testar-deteccao-reply.sh
```

## Interpretação dos Resultados

### ✅ Sinais de Sucesso
- Webhook responde com HTTP 200
- Logs "Update recebido" aparecem
- Logs "Debug da chave" são gerados
- Logs "Processando resposta" são executados
- Aposta é removida do cache

### ❌ Sinais de Problema
- Webhook não responde ou erro HTTP
- Logs do webhook não são gerados
- `hasReplyTo: false` nos logs
- Aposta permanece no cache
- Logs de "Debug da chave" não aparecem

## Possíveis Causas e Soluções

### Problema 1: Logs não são gerados
**Causa:** Webhook não está sendo executado
**Solução:** Verificar roteamento e configuração do Next.js

### Problema 2: `hasReplyTo: false`
**Causa:** Estrutura do payload incorreta
**Solução:** Ajustar formato do `reply_to_message`

### Problema 3: Chave não encontrada
**Causa:** Inconsistência na geração da `betKey`
**Solução:** Verificar lógica de geração da chave

### Problema 4: Processamento não executado
**Causa:** Condições de validação falhando
**Solução:** Revisar lógica de validação no webhook

## Próximos Passos

1. **Execute os scripts na ordem recomendada**
2. **Analise os resultados de cada fase**
3. **Identifique onde o processo falha**
4. **Aplique a correção específica**
5. **Re-teste para confirmar a correção**

## Comandos de Execução no Servidor

```bash
# Conectar ao servidor
ssh root@autosheets.loudigital.shop

# Navegar para o diretório
cd ~/autosheets

# Dar permissões aos scripts
chmod +x scripts/*.sh

# Executar diagnóstico completo
./scripts/testar-logs-webhook.sh
./scripts/debug-payload-estrutura.sh
```

## Monitoramento em Tempo Real

```bash
# Logs do container principal
docker logs -f autosheets_app

# Logs específicos do webhook
docker logs -f autosheets_app | grep -E "(webhook|reply|Update|Debug)"

# Status dos containers
watch -n 2 'docker ps | grep autosheets'
```

---

**Nota:** Este documento será atualizado conforme novos scripts sejam criados ou problemas sejam identificados.