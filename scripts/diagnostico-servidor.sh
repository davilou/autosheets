#!/bin/bash

# Script de Diagnóstico do Sistema de Replies - Servidor
# Execute este script no servidor via SSH

echo "🔍 DIAGNÓSTICO DO SISTEMA DE REPLIES - SERVIDOR"
echo "================================================"
echo ""

# Verificar se estamos no diretório correto
if [ ! -f "docker-compose.prod.yml" ]; then
    echo "❌ Erro: docker-compose.prod.yml não encontrado"
    echo "   Certifique-se de estar no diretório correto do projeto"
    exit 1
fi

echo "📁 Diretório atual: $(pwd)"
echo ""

# 1. Verificar containers
echo "🐳 1. VERIFICANDO CONTAINERS"
echo "----------------------------"
docker-compose -f docker-compose.prod.yml ps
echo ""

# 2. Verificar se o container autosheets está rodando
echo "🔍 2. STATUS DO CONTAINER AUTOSHEETS"
echo "-----------------------------------"
AUTOSHEETS_STATUS=$(docker-compose -f docker-compose.prod.yml ps autosheets --format "table {{.State}}" | tail -n 1)
echo "Status: $AUTOSHEETS_STATUS"

if [[ "$AUTOSHEETS_STATUS" != *"Up"* ]]; then
    echo "❌ Container autosheets não está rodando!"
    echo "   Tentando iniciar..."
    docker-compose -f docker-compose.prod.yml up -d autosheets
    sleep 5
else
    echo "✅ Container autosheets está rodando"
fi
echo ""

# 3. Verificar variáveis de ambiente
echo "🔧 3. VERIFICANDO VARIÁVEIS DE AMBIENTE"
echo "---------------------------------------"
echo "TELEGRAM_BOT_TOKEN:"
docker-compose -f docker-compose.prod.yml exec -T autosheets env | grep TELEGRAM_BOT_TOKEN | head -c 50
echo "..."
echo "WEBHOOK_URL:"
docker-compose -f docker-compose.prod.yml exec -T autosheets env | grep WEBHOOK_URL
echo ""

# 4. Verificar status do webhook
echo "📡 4. STATUS DO WEBHOOK DO TELEGRAM"
echo "----------------------------------"
docker-compose -f docker-compose.prod.yml exec -T autosheets npm run webhook:info
echo ""

# 5. Testar conectividade do webhook
echo "🌐 5. TESTANDO CONECTIVIDADE DO WEBHOOK"
echo "--------------------------------------"
WEBHOOK_URL=$(docker-compose -f docker-compose.prod.yml exec -T autosheets env | grep WEBHOOK_URL | cut -d'=' -f2 | tr -d '\r')
echo "Testando: $WEBHOOK_URL"
curl -s -o /dev/null -w "Status HTTP: %{http_code}\n" -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"message":{"message_id":123,"text":"teste"}}'
echo ""

# 6. Verificar logs recentes
echo "📋 6. LOGS RECENTES (ÚLTIMAS 20 LINHAS)"
echo "---------------------------------------"
docker-compose -f docker-compose.prod.yml logs autosheets --tail=20
echo ""

# 7. Testar processamento de reply
echo "🧪 7. TESTE DE PROCESSAMENTO DE REPLY"
echo "------------------------------------"
echo "Executando teste de webhook..."
docker-compose -f docker-compose.prod.yml exec -T autosheets node test-webhook-reply.js
echo ""

# 8. Verificar se há erros nos logs
echo "🚨 8. VERIFICANDO ERROS NOS LOGS"
echo "--------------------------------"
ERROR_COUNT=$(docker-compose -f docker-compose.prod.yml logs autosheets --tail=100 | grep -i error | wc -l)
echo "Número de erros encontrados nos últimos 100 logs: $ERROR_COUNT"

if [ $ERROR_COUNT -gt 0 ]; then
    echo "❌ Erros encontrados:"
    docker-compose -f docker-compose.prod.yml logs autosheets --tail=100 | grep -i error | tail -5
else
    echo "✅ Nenhum erro encontrado nos logs recentes"
fi
echo ""

# 9. Verificar conectividade de rede
echo "🌍 9. VERIFICANDO CONECTIVIDADE DE REDE"
echo "---------------------------------------"
echo "Testando conectividade com api.telegram.org:"
docker-compose -f docker-compose.prod.yml exec -T autosheets curl -s -o /dev/null -w "Status: %{http_code}\n" https://api.telegram.org/bot
echo ""

# 10. Resumo
echo "📊 10. RESUMO DO DIAGNÓSTICO"
echo "============================"
echo "✅ Itens verificados:"
echo "   - Status dos containers"
echo "   - Variáveis de ambiente"
echo "   - Status do webhook"
echo "   - Conectividade do endpoint"
echo "   - Logs da aplicação"
echo "   - Teste de processamento"
echo "   - Verificação de erros"
echo "   - Conectividade de rede"
echo ""
echo "🔍 Para monitorar em tempo real:"
echo "   docker-compose -f docker-compose.prod.yml logs -f autosheets"
echo ""
echo "🧪 Para testar um reply real:"
echo "   1. Envie uma mensagem no grupo monitorado"
echo "   2. Responda a mensagem"
echo "   3. Monitore os logs em tempo real"
echo ""
echo "📝 Diagnóstico concluído!"