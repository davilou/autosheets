#!/bin/bash

# Script para diagnosticar e corrigir problemas do nginx
# Baseado na análise dos logs que mostram nginx falhando continuamente

echo "🔧 DIAGNÓSTICO E CORREÇÃO DO NGINX"
echo "==================================="
echo ""

echo "📊 1. VERIFICANDO STATUS ATUAL DOS SERVIÇOS:"
echo "------------------------------------------"
docker compose -f docker-compose.prod.yml ps
echo ""

echo "📋 2. LOGS DO NGINX (últimos 50 linhas):"
echo "---------------------------------------"
docker compose -f docker-compose.prod.yml logs nginx --tail=50
echo ""

echo "⚙️ 3. VERIFICANDO CONFIGURAÇÃO DO NGINX:"
echo "---------------------------------------"
echo "Testando configuração..."
docker compose -f docker-compose.prod.yml exec nginx nginx -t 2>/dev/null || echo "❌ Configuração inválida"
echo ""

echo "📁 4. VERIFICANDO ARQUIVO DE CONFIGURAÇÃO:"
echo "-----------------------------------------"
echo "Conteúdo do nginx.conf:"
docker compose -f docker-compose.prod.yml exec nginx cat /etc/nginx/nginx.conf 2>/dev/null || echo "❌ Não foi possível ler configuração"
echo ""

echo "🌐 5. TESTANDO CONECTIVIDADE INTERNA:"
echo "------------------------------------"
echo "Testando se a aplicação responde na porta 3000..."
docker compose -f docker-compose.prod.yml exec nginx curl -I http://autosheets:3000/api/telegram/webhook 2>/dev/null || echo "❌ Aplicação não responde"
echo ""

echo "🔄 6. REINICIANDO NGINX:"
echo "-----------------------"
echo "Parando nginx..."
docker compose -f docker-compose.prod.yml stop nginx
echo "Aguardando 3 segundos..."
sleep 3
echo "Iniciando nginx..."
docker compose -f docker-compose.prod.yml start nginx
echo "Aguardando 5 segundos para estabilizar..."
sleep 5
echo ""

echo "✅ 7. VERIFICANDO STATUS APÓS REINÍCIO:"
echo "--------------------------------------"
docker compose -f docker-compose.prod.yml ps nginx
echo ""

echo "🧪 8. TESTANDO WEBHOOK APÓS CORREÇÃO:"
echo "------------------------------------"
echo "Testando webhook externamente..."
WEBHOOK_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://autosheets.loudigital.shop/api/telegram/webhook || echo "000")
echo "Código de resposta: $WEBHOOK_RESPONSE"

if [ "$WEBHOOK_RESPONSE" = "200" ] || [ "$WEBHOOK_RESPONSE" = "405" ]; then
    echo "✅ Webhook respondendo corretamente!"
else
    echo "❌ Webhook ainda não responde (código: $WEBHOOK_RESPONSE)"
fi
echo ""

echo "🔍 9. DIAGNÓSTICO ADICIONAL (se ainda houver problemas):"
echo "-------------------------------------------------------"
if [ "$WEBHOOK_RESPONSE" != "200" ] && [ "$WEBHOOK_RESPONSE" != "405" ]; then
    echo "Verificando portas da aplicação..."
    docker compose -f docker-compose.prod.yml exec autosheets netstat -tlnp 2>/dev/null || echo "❌ Não foi possível verificar portas"
    echo ""
    
    echo "Verificando se o processo Next.js está rodando..."
    docker compose -f docker-compose.prod.yml exec autosheets ps aux | grep next 2>/dev/null || echo "❌ Processo Next.js não encontrado"
    echo ""
    
    echo "Testando conectividade direta com a aplicação..."
    docker compose -f docker-compose.prod.yml exec autosheets curl -I http://localhost:3000/api/telegram/webhook 2>/dev/null || echo "❌ Aplicação não responde localmente"
fi
echo ""

echo "📋 10. RESUMO DO DIAGNÓSTICO:"
echo "============================"
echo "Status do nginx: $(docker compose -f docker-compose.prod.yml ps nginx --format 'table {{.State}}')"
echo "Webhook responde: $WEBHOOK_RESPONSE"
echo ""

echo "🎯 PRÓXIMOS PASSOS:"
echo "=================="
if [ "$WEBHOOK_RESPONSE" = "200" ] || [ "$WEBHOOK_RESPONSE" = "405" ]; then
    echo "✅ Nginx corrigido! Agora você pode:"
    echo "1. Testar o sistema de replies manualmente"
    echo "2. Executar: ./scripts/testar-webhook-manual.sh"
    echo "3. Fazer um reply real no Telegram para validar"
else
    echo "❌ Nginx ainda com problemas. Verifique:"
    echo "1. Configuração do nginx.conf"
    echo "2. Se a aplicação está rodando na porta 3000"
    echo "3. Logs detalhados: docker compose -f docker-compose.prod.yml logs nginx"
    echo "4. Considere recriar os containers: docker compose -f docker-compose.prod.yml up -d --force-recreate"
fi
echo ""

echo "🔧 COMANDOS DE EMERGÊNCIA:"
echo "========================="
echo "# Recriar todos os containers:"
echo "docker compose -f docker-compose.prod.yml down && docker compose -f docker-compose.prod.yml up -d"
echo ""
echo "# Verificar logs em tempo real:"
echo "docker compose -f docker-compose.prod.yml logs -f nginx"
echo ""
echo "# Acessar container do nginx:"
echo "docker compose -f docker-compose.prod.yml exec nginx sh"
echo ""