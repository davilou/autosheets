#!/bin/bash

# 🔍 DIAGNÓSTICO FINAL - PROBLEMA DE REPLIES
# ==========================================

echo "🔍 DIAGNÓSTICO FINAL - PROBLEMA DE REPLIES"
echo "=========================================="
echo ""

# Função para verificar nome correto do serviço
echo "📋 VERIFICANDO SERVIÇOS DISPONÍVEIS:"
echo "----------------------------------"
docker compose -f docker-compose.prod.yml ps
echo ""

# Verificar logs do serviço correto
echo "📊 LOGS DO SERVIÇO PRINCIPAL:"
echo "----------------------------"
docker compose -f docker-compose.prod.yml logs autosheets | grep -E "(webhook|reply|POST|💰|betKey|CACHE)" | tail -20
echo ""

# Verificar se o webhook está recebendo requests
echo "🌐 VERIFICANDO WEBHOOK (últimos 50 logs):"
echo "----------------------------------------"
docker compose -f docker-compose.prod.yml logs autosheets | grep -E "(POST|webhook|api/telegram)" | tail -50
echo ""

# Verificar logs específicos de reply
echo "💬 LOGS ESPECÍFICOS DE REPLY:"
echo "-----------------------------"
docker compose -f docker-compose.prod.yml logs autosheets | grep -i "reply" | tail -20
echo ""

# Verificar se há erros no webhook
echo "❌ ERROS NO WEBHOOK:"
echo "-------------------"
docker compose -f docker-compose.prod.yml logs autosheets | grep -E "(error|Error|ERROR)" | tail -20
echo ""

# Verificar cache atual
echo "📦 CACHE ATUAL:"
echo "--------------"
docker compose -f docker-compose.prod.yml exec autosheets cat .bet-cache.json 2>/dev/null || echo "❌ Cache não encontrado"
echo ""

# Verificar se o webhook está configurado corretamente
echo "⚙️ CONFIGURAÇÃO DO WEBHOOK:"
echo "---------------------------"
docker compose -f docker-compose.prod.yml exec autosheets env | grep -E "(TELEGRAM|WEBHOOK)"
echo ""

# Teste de conectividade do webhook
echo "🧪 TESTE DE CONECTIVIDADE DO WEBHOOK:"
echo "------------------------------------"
echo "Testando se o webhook responde..."
curl -s -o /dev/null -w "%{http_code}" "https://autosheets.loudigital.shop/api/telegram/webhook" || echo "❌ Webhook não responde"
echo ""

# Verificar se há mensagens sendo processadas
echo "📨 MENSAGENS SENDO PROCESSADAS:"
echo "------------------------------"
docker compose -f docker-compose.prod.yml logs autosheets | grep -E "(Nova mensagem|Processando|💰)" | tail -10
echo ""

echo "🎯 RESUMO DO DIAGNÓSTICO:"
echo "========================"
echo "1. ✅ Monitor conectado: $(docker compose -f docker-compose.prod.yml logs autosheets | grep 'Monitor GramJS conectado' | wc -l) vezes"
echo "2. 📦 Cache existe: $(docker compose -f docker-compose.prod.yml exec autosheets test -f .bet-cache.json && echo 'SIM' || echo 'NÃO')"
echo "3. 🌐 Webhook responde: $(curl -s -o /dev/null -w "%{http_code}" "https://autosheets.loudigital.shop/api/telegram/webhook" 2>/dev/null || echo 'ERRO')"
echo "4. 💬 Replies processados: $(docker compose -f docker-compose.prod.yml logs autosheets | grep -i 'reply' | wc -l) encontrados"
echo ""

echo "📋 PRÓXIMOS PASSOS:"
echo "=================="
echo "1. Se webhook não responde (código != 200):"
echo "   - Verificar configuração do nginx"
echo "   - Verificar se a aplicação está rodando na porta correta"
echo ""
echo "2. Se não há logs de reply:"
echo "   - Verificar se o Telegram está enviando os webhooks"
echo "   - Testar manualmente com curl"
echo ""
echo "3. Se cache existe mas replies não processam:"
echo "   - Verificar se a chave está sendo gerada corretamente"
echo "   - Verificar se o webhook está conectado ao monitor"
echo ""