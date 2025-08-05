#!/bin/bash

# Script para testar as correções implementadas no sistema de replies
# Verifica se o monitor está se conectando automaticamente ao webhook

echo "🧪 TESTE DAS CORREÇÕES - SISTEMA DE REPLIES"
echo "==========================================="
echo ""

# Função para verificar logs de conexão do monitor
verificar_conexao_monitor() {
    echo "🔗 VERIFICANDO CONEXÃO DO MONITOR:"
    echo "----------------------------------"
    
    echo "🔍 Procurando logs de conexão automática:"
    docker compose -f docker-compose.prod.yml logs autosheets --tail=50 | grep -E "(Monitor não conectado|Tentando conectar|Monitor GramJS conectado ao webhook|Status do monitor)"
    
    echo ""
    echo "🔍 Verificando status atual do monitor:"
    docker compose -f docker-compose.prod.yml logs autosheets --tail=20 | grep -E "(CONECTADO|DESCONECTADO)"
    
    echo ""
}

# Função para testar webhook com logs detalhados
testar_webhook_detalhado() {
    echo "📡 TESTANDO WEBHOOK COM LOGS DETALHADOS:"
    echo "----------------------------------------"
    
    # Verificar se há apostas no cache
    echo "📦 Verificando cache antes do teste:"
    if docker compose -f docker-compose.prod.yml exec autosheets test -f ".bet-cache.json"; then
        echo "✅ Cache existe"
        CACHE_CONTENT=$(docker compose -f docker-compose.prod.yml exec autosheets cat .bet-cache.json)
        echo "📋 Conteúdo: $CACHE_CONTENT"
        
        # Extrair primeira chave
        FIRST_KEY=$(echo $CACHE_CONTENT | jq -r 'keys[0]' 2>/dev/null)
        
        if [ "$FIRST_KEY" != "null" ] && [ "$FIRST_KEY" != "" ]; then
            echo "🔑 Chave para teste: $FIRST_KEY"
            
            # Extrair componentes da chave
            USER_ID=$(echo $FIRST_KEY | cut -d'_' -f1)
            MESSAGE_ID=$(echo $FIRST_KEY | cut -d'_' -f2)
            
            echo "👤 User ID: $USER_ID"
            echo "📨 Message ID: $MESSAGE_ID"
            echo ""
            
            # Monitorar logs em tempo real
            echo "📊 Iniciando monitoramento de logs..."
            docker compose -f docker-compose.prod.yml logs -f autosheets &
            LOGS_PID=$!
            
            sleep 2
            
            echo "📡 Enviando reply de teste..."
            
            # Enviar reply simulado
            RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "https://autosheets.loudigital.com.br/api/telegram/webhook" \
                 -H "Content-Type: application/json" \
                 -d "{
                     \"update_id\": 999999999,
                     \"message\": {
                         \"message_id\": 777,
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
                 }")
            
            # Extrair status HTTP
            HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
            RESPONSE_BODY=$(echo "$RESPONSE" | grep -v "HTTP_STATUS")
            
            echo "📊 Resposta do webhook:"
            echo "   Status: $HTTP_STATUS"
            echo "   Body: $RESPONSE_BODY"
            echo ""
            
            # Aguardar processamento
            echo "⏳ Aguardando 5 segundos para processamento..."
            sleep 5
            
            # Parar monitoramento de logs
            kill $LOGS_PID 2>/dev/null
            
            echo "📊 Verificando resultado do teste:"
            echo "----------------------------------"
            
            # Verificar logs específicos do teste
            echo "🔍 Logs de conexão do monitor:"
            docker compose -f docker-compose.prod.yml logs autosheets --tail=30 | grep -E "(Monitor não conectado|Tentando conectar|Monitor GramJS conectado|Status do monitor)"
            
            echo ""
            echo "🔍 Logs de processamento do cache:"
            docker compose -f docker-compose.prod.yml logs autosheets --tail=30 | grep -E "(\[CACHE\]|Procurando chave|Chave encontrada|Dados da aposta)"
            
            echo ""
            echo "🔍 Logs de processamento da aposta:"
            docker compose -f docker-compose.prod.yml logs autosheets --tail=30 | grep -E "(Processando resposta|💰|✅|❌)"
            
            echo ""
            echo "📦 Estado do cache após o teste:"
            if docker compose -f docker-compose.prod.yml exec autosheets test -f ".bet-cache.json"; then
                NEW_CACHE=$(docker compose -f docker-compose.prod.yml exec autosheets cat .bet-cache.json)
                echo "📋 Novo conteúdo: $NEW_CACHE"
                
                # Verificar se a chave foi removida (indicando processamento bem-sucedido)
                if echo "$NEW_CACHE" | jq -e ".\"$FIRST_KEY\"" > /dev/null 2>&1; then
                    echo "⚠️ Chave ainda existe - reply pode não ter sido processado"
                else
                    echo "✅ Chave removida - reply foi processado com sucesso!"
                fi
            else
                echo "❌ Cache não existe mais"
            fi
            
        else
            echo "❌ Nenhuma chave válida no cache para teste"
        fi
    else
        echo "❌ Cache não existe - não há apostas para testar"
        echo "💡 Execute primeiro uma detecção de aposta para criar o cache"
    fi
    
    echo ""
}

# Função para verificar melhorias no cache
verificar_melhorias_cache() {
    echo "📋 VERIFICANDO MELHORIAS NO CACHE:"
    echo "----------------------------------"
    
    echo "🔍 Procurando logs detalhados do cache:"
    docker compose -f docker-compose.prod.yml logs autosheets --tail=50 | grep -E "(\[CACHE\]|Total de apostas|Chaves disponíveis|Chave.*encontrada)"
    
    echo ""
}

# Função para análise de resultados
analisar_resultados() {
    echo "📊 ANÁLISE DOS RESULTADOS:"
    echo "==========================="
    
    echo "✅ VERIFICAÇÕES REALIZADAS:"
    echo "1. Conexão automática do monitor ao webhook"
    echo "2. Logs detalhados do cache"
    echo "3. Processamento de reply simulado"
    echo "4. Remoção da aposta do cache após processamento"
    echo ""
    
    echo "🎯 INDICADORES DE SUCESSO:"
    echo "- Monitor conectado automaticamente"
    echo "- Logs '[CACHE]' aparecem com detalhes"
    echo "- Reply é processado (logs '💰 Processando resposta')"
    echo "- Chave é removida do cache após processamento"
    echo ""
    
    echo "🚨 INDICADORES DE PROBLEMA:"
    echo "- Monitor permanece 'DESCONECTADO'"
    echo "- Erro ao conectar monitor"
    echo "- Chave não encontrada no cache"
    echo "- Chave permanece no cache após teste"
    echo ""
}

# Função principal
main() {
    echo "🚀 Iniciando teste das correções..."
    echo ""
    
    verificar_conexao_monitor
    verificar_melhorias_cache
    
    echo "🧪 TESTE PRÁTICO:"
    echo "================="
    read -p "Deseja executar teste de reply simulado? (s/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        testar_webhook_detalhado
    fi
    
    analisar_resultados
    
    echo "📋 PRÓXIMOS PASSOS:"
    echo "=================="
    echo "1. Se o monitor não conectar automaticamente:"
    echo "   - Verificar variáveis de ambiente"
    echo "   - Reiniciar aplicação"
    echo ""
    echo "2. Se o cache não mostrar logs detalhados:"
    echo "   - Verificar se as alterações foram aplicadas"
    echo "   - Reiniciar aplicação"
    echo ""
    echo "3. Se o reply não for processado:"
    echo "   - Verificar se a chave está correta"
    echo "   - Verificar conectividade do webhook"
    echo ""
    echo "4. Para teste real:"
    echo "   - Enviar aposta em grupo monitorado"
    echo "   - Responder à notificação privada"
    echo "   - Verificar se foi salva na planilha"
    echo ""
}

# Executar teste
main