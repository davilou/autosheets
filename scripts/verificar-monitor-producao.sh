#!/bin/bash

# Script para verificar se o monitor GramJS está funcionando em produção
# Execute este script no servidor via SSH

echo "🔍 VERIFICAÇÃO DO MONITOR GRAMJS EM PRODUÇÃO"
echo "============================================"
echo ""

# Verificar se estamos no diretório correto
if [ ! -f "docker-compose.prod.yml" ]; then
    echo "❌ Erro: docker-compose.prod.yml não encontrado"
    echo "   Certifique-se de estar no diretório correto do projeto"
    exit 1
fi

echo "📁 Diretório atual: $(pwd)"
echo ""

# 1. Verificar se o container está rodando
echo "🐳 1. STATUS DO CONTAINER AUTOSHEETS"
echo "-----------------------------------"
docker compose -f docker-compose.prod.yml ps autosheets
echo ""

# 2. Verificar se as variáveis do Telegram estão configuradas
echo "🔧 2. VARIÁVEIS DO TELEGRAM"
echo "---------------------------"
echo "Verificando variáveis essenciais para o monitor GramJS:"
docker compose -f docker-compose.prod.yml exec autosheets env | grep -E "TELEGRAM_(API_ID|API_HASH|SESSION_STRING|BOT_TOKEN)" | while read line; do
    var_name=$(echo $line | cut -d'=' -f1)
    var_value=$(echo $line | cut -d'=' -f2)
    if [ -n "$var_value" ]; then
        echo "✅ $var_name: Configurado"
    else
        echo "❌ $var_name: VAZIO"
    fi
done
echo ""

# 3. Verificar se o monitor está sendo iniciado
echo "🚀 3. VERIFICANDO INICIALIZAÇÃO DO MONITOR"
echo "------------------------------------------"
echo "Verificando se o script start.sh está executando o monitor:"
docker compose -f docker-compose.prod.yml exec autosheets cat start.sh | grep -E "(monitor|TELEGRAM)"
echo ""

# 4. Verificar processos rodando no container
echo "⚙️  4. PROCESSOS RODANDO NO CONTAINER"
echo "------------------------------------"
echo "Verificando se o monitor GramJS está rodando:"
docker compose -f docker-compose.prod.yml exec autosheets ps aux | grep -E "(node|tsx|monitor)"
echo ""

# 5. Verificar logs específicos do monitor
echo "📋 5. LOGS DO MONITOR GRAMJS"
echo "----------------------------"
echo "Últimos logs relacionados ao monitor GramJS:"
docker compose -f docker-compose.prod.yml logs autosheets --tail=50 | grep -E "(GramJS|Monitor|monitor|🚀|📱|🔗)"
echo ""

# 6. Testar se o webhook está conectado ao monitor
echo "🔗 6. CONEXÃO WEBHOOK <-> MONITOR"
echo "---------------------------------"
echo "Verificando se o monitor está conectado ao webhook:"
docker compose -f docker-compose.prod.yml logs autosheets --tail=100 | grep -E "(setGramJSMonitor|Monitor.*conectado|webhook.*conectado)"
echo ""

# 7. Verificar se há erros relacionados ao monitor
echo "❌ 7. ERROS DO MONITOR"
echo "----------------------"
echo "Verificando erros relacionados ao monitor GramJS:"
docker compose -f docker-compose.prod.yml logs autosheets --tail=100 | grep -E "(erro|error|Error|❌)" | grep -i -E "(gramjs|monitor|telegram)"
echo ""

# 8. Teste de conectividade do monitor
echo "🌐 8. TESTE DE CONECTIVIDADE"
echo "-----------------------------"
echo "Testando conectividade com a API do Telegram:"
docker compose -f docker-compose.prod.yml exec autosheets curl -s "https://api.telegram.org/bot$(docker compose -f docker-compose.prod.yml exec autosheets env | grep TELEGRAM_BOT_TOKEN | cut -d'=' -f2)/getMe" | head -c 100
echo ""
echo ""

# 9. Resumo e recomendações
echo "📊 9. RESUMO E RECOMENDAÇÕES"
echo "============================"
echo ""
echo "Para que o sistema de replies funcione, é necessário que:"
echo "✅ 1. Container autosheets esteja rodando"
echo "✅ 2. Variáveis TELEGRAM_* estejam configuradas"
echo "✅ 3. Monitor GramJS seja iniciado pelo start.sh"
echo "✅ 4. Monitor esteja conectado ao webhook"
echo "✅ 5. Não haja erros na inicialização"
echo ""
echo "Se algum item acima falhar, execute:"
echo "   docker compose -f docker-compose.prod.yml restart autosheets"
echo ""
echo "Para monitorar em tempo real:"
echo "   docker compose -f docker-compose.prod.yml logs -f autosheets"
echo ""
echo "Para testar um reply:"
echo "   1. Envie uma mensagem de aposta em um grupo monitorado"
echo "   2. Aguarde a notificação privada do bot"
echo "   3. Responda à notificação com uma odd"
echo "   4. Verifique os logs para confirmar o processamento"
echo ""