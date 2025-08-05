#!/bin/bash

# Script de diagnóstico detalhado para o problema de replies
# Analisa a sincronização entre monitor GramJS e webhook

echo "🔍 DIAGNÓSTICO DETALHADO - SISTEMA DE REPLIES"
echo "================================================"
echo ""

# Função para verificar cache de apostas
verificar_cache() {
    echo "📦 VERIFICANDO CACHE DE APOSTAS:"
    echo "--------------------------------"
    
    # Verificar se o arquivo de cache existe
    if docker compose -f docker-compose.prod.yml exec autosheets test -f ".bet-cache.json"; then
        echo "✅ Arquivo .bet-cache.json existe"
        
        # Mostrar conteúdo do cache
        echo "📋 Conteúdo do cache:"
        docker compose -f docker-compose.prod.yml exec autosheets cat .bet-cache.json | jq .
        
        # Contar apostas no cache
        CACHE_COUNT=$(docker compose -f docker-compose.prod.yml exec autosheets cat .bet-cache.json | jq 'length')
        echo "📊 Total de apostas no cache: $CACHE_COUNT"
        
        # Listar chaves das apostas
        echo "🔑 Chaves das apostas no cache:"
        docker compose -f docker-compose.prod.yml exec autosheets cat .bet-cache.json | jq -r 'keys[]'
        
    else
        echo "❌ Arquivo .bet-cache.json não existe"
    fi
    echo ""
}

# Função para verificar logs do monitor
verificar_logs_monitor() {
    echo "📊 LOGS DO MONITOR GRAMJS:"
    echo "-------------------------"
    
    # Logs relacionados ao salvamento de apostas
    echo "🔍 Logs de salvamento de apostas (últimas 20 linhas):"
    docker compose -f docker-compose.prod.yml logs autosheets --tail=100 | grep -E "(Notificação enviada|Aposta salva|betKey|💾|📤)" | tail -20
    
    echo ""
    echo "🔍 Logs de processamento de mensagens (últimas 10 linhas):"
    docker compose -f docker-compose.prod.yml logs autosheets --tail=100 | grep -E "(Analisando mensagem|Aposta detectada|🎯|⚽)" | tail -10
    
    echo ""
}

# Função para verificar logs do webhook
verificar_logs_webhook() {
    echo "🌐 LOGS DO WEBHOOK:"
    echo "------------------"
    
    # Logs relacionados ao processamento de replies
    echo "🔍 Logs de processamento de replies (últimas 20 linhas):"
    docker compose -f docker-compose.prod.yml logs autosheets --tail=100 | grep -E "(Webhook recebido|reply_to_message|betKey|Processando resposta|💰|🔍)" | tail -20
    
    echo ""
    echo "🔍 Logs de busca no cache (últimas 10 linhas):"
    docker compose -f docker-compose.prod.yml logs autosheets --tail=100 | grep -E "(Verificando cache|Procurando chave|Chaves disponíveis|📋|🔍)" | tail -10
    
    echo ""
}

# Função para simular um reply e monitorar
simular_reply_monitorado() {
    echo "🧪 SIMULANDO REPLY COM MONITORAMENTO:"
    echo "------------------------------------"
    
    # Primeiro, verificar se há apostas no cache
    echo "📦 Estado do cache antes do teste:"
    if docker compose -f docker-compose.prod.yml exec autosheets test -f ".bet-cache.json"; then
        docker compose -f docker-compose.prod.yml exec autosheets cat .bet-cache.json | jq 'keys[]'
    else
        echo "❌ Nenhuma aposta no cache"
        echo "⚠️ Para testar replies, primeiro precisa haver uma aposta detectada"
        return
    fi
    
    echo ""
    echo "📡 Enviando reply simulado..."
    
    # Simular reply (usando a primeira chave do cache se existir)
    FIRST_KEY=$(docker compose -f docker-compose.prod.yml exec autosheets cat .bet-cache.json 2>/dev/null | jq -r 'keys[0]' 2>/dev/null)
    
    if [ "$FIRST_KEY" != "null" ] && [ "$FIRST_KEY" != "" ]; then
        echo "🔑 Usando chave existente: $FIRST_KEY"
        
        # Extrair userId e messageId da chave
        USER_ID=$(echo $FIRST_KEY | cut -d'_' -f1)
        MESSAGE_ID=$(echo $FIRST_KEY | cut -d'_' -f2)
        
        echo "👤 User ID: $USER_ID"
        echo "📨 Message ID: $MESSAGE_ID"
        
        # Simular webhook reply
        curl -X POST "https://autosheets.loudigital.com.br/api/telegram/webhook" \
             -H "Content-Type: application/json" \
             -d "{
                 \"update_id\": 999999999,
                 \"message\": {
                     \"message_id\": 888,
                     \"from\": {
                         \"id\": $USER_ID,
                         \"is_bot\": false,
                         \"first_name\": \"Test User\"
                     },
                     \"chat\": {
                         \"id\": $USER_ID,
                         \"type\": \"private\"
                     },
                     \"date\": $(date +%s),
                     \"text\": \"1.85\",
                     \"reply_to_message\": {
                         \"message_id\": $MESSAGE_ID,
                         \"from\": {
                             \"id\": 7487941746,
                             \"is_bot\": true,
                             \"first_name\": \"ApostasMonitorBot\"
                         },
                         \"date\": $(($(date +%s) - 60)),
                         \"text\": \"Mensagem de notificação\"
                     }
                 }
             }"
        
        echo ""
        echo "⏳ Aguardando 3 segundos para processamento..."
        sleep 3
        
        echo "📊 Logs após o teste:"
        docker compose -f docker-compose.prod.yml logs autosheets --tail=20 | grep -E "(Webhook recebido|betKey|Processando|💰|✅|❌)"
        
        echo ""
        echo "📦 Estado do cache após o teste:"
        if docker compose -f docker-compose.prod.yml exec autosheets test -f ".bet-cache.json"; then
            docker compose -f docker-compose.prod.yml exec autosheets cat .bet-cache.json | jq .
        else
            echo "❌ Cache não existe mais"
        fi
        
    else
        echo "❌ Nenhuma chave válida encontrada no cache"
    fi
    
    echo ""
}

# Função para verificar conectividade monitor-webhook
verificar_conectividade() {
    echo "🔗 VERIFICANDO CONECTIVIDADE MONITOR-WEBHOOK:"
    echo "---------------------------------------------"
    
    # Verificar se o monitor está conectado ao webhook
    echo "🔍 Procurando logs de conexão monitor-webhook:"
    docker compose -f docker-compose.prod.yml logs autosheets --tail=50 | grep -E "(setGramJSMonitor|Monitor GramJS conectado|🔗)"
    
    echo ""
    echo "🔍 Verificando se o monitor está disponível no webhook:"
    docker compose -f docker-compose.prod.yml logs autosheets --tail=50 | grep -E "(Monitor disponível|gramjsMonitor|⚠️)"
    
    echo ""
}

# Função principal
main() {
    echo "🚀 Iniciando diagnóstico detalhado..."
    echo ""
    
    verificar_cache
    verificar_logs_monitor
    verificar_logs_webhook
    verificar_conectividade
    
    echo "🧪 TESTE PRÁTICO:"
    echo "================"
    read -p "Deseja simular um reply para teste? (s/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        simular_reply_monitorado
    fi
    
    echo ""
    echo "📋 RESUMO DO DIAGNÓSTICO:"
    echo "========================="
    echo "1. ✅ Verifique se há apostas no cache"
    echo "2. ✅ Verifique se o monitor está salvando apostas"
    echo "3. ✅ Verifique se o webhook está recebendo replies"
    echo "4. ✅ Verifique se o monitor está conectado ao webhook"
    echo "5. ✅ Teste prático de reply simulado"
    echo ""
    echo "💡 PRÓXIMOS PASSOS:"
    echo "- Se cache vazio: problema no monitor (não detecta apostas)"
    echo "- Se cache com apostas mas replies não funcionam: problema na conexão monitor-webhook"
    echo "- Se webhook não recebe: problema na configuração do bot Telegram"
    echo ""
}

# Executar diagnóstico
main