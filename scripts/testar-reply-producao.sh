#!/bin/bash

# Script para testar o processamento de replies em produção
# Execute este script no servidor via SSH

echo "🧪 TESTE DE PROCESSAMENTO DE REPLIES - PRODUÇÃO"
echo "==============================================="
echo ""

# Verificar se estamos no diretório correto
if [ ! -f "docker-compose.prod.yml" ]; then
    echo "❌ Erro: docker-compose.prod.yml não encontrado"
    echo "   Certifique-se de estar no diretório correto do projeto"
    exit 1
fi

# Função para simular um reply
testar_reply() {
    local user_id="670237902"
    local replied_message_id="123"
    local odd_value="1.85"
    
    echo "🎯 Simulando reply com:"
    echo "   - User ID: $user_id"
    echo "   - Replied Message ID: $replied_message_id"
    echo "   - Odd: $odd_value"
    echo ""
    
    # Payload do teste
    local payload='{
        "message": {
            "message_id": 456,
            "from": {
                "id": '"$user_id"',
                "first_name": "Teste"
            },
            "chat": {
                "id": '"$user_id"',
                "type": "private"
            },
            "text": "'"$odd_value"'",
            "reply_to_message": {
                "message_id": '"$replied_message_id"'
            }
        }
    }'
    
    echo "📤 Enviando payload de teste para o webhook..."
    
    # Testar o webhook
    response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
        "https://autosheets.loudigital.shop/api/telegram/webhook" \
        -H "Content-Type: application/json" \
        -d "$payload")
    
    echo "📥 Resposta do webhook:"
    echo "$response"
    echo ""
    
    # Extrair código HTTP
    http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
    
    if [ "$http_code" = "200" ]; then
        echo "✅ Webhook respondeu com sucesso (200)"
    else
        echo "❌ Webhook retornou código: $http_code"
    fi
    
    echo ""
}

# Função para monitorar logs em tempo real
monitorar_logs() {
    echo "📋 Monitorando logs em tempo real..."
    echo "   (Pressione Ctrl+C para parar)"
    echo ""
    
    # Monitorar logs filtrados
    docker compose -f docker-compose.prod.yml logs -f autosheets | grep -E "(reply|betKey|processamento|Debug|🔍|💰|❌|✅)"
}

# Menu principal
echo "Escolha uma opção:"
echo "1) Testar reply simulado"
echo "2) Monitorar logs em tempo real"
echo "3) Verificar status do sistema"
echo "4) Executar teste completo"
echo ""
read -p "Digite sua opção (1-4): " opcao

case $opcao in
    1)
        echo ""
        testar_reply
        ;;
    2)
        echo ""
        monitorar_logs
        ;;
    3)
        echo ""
        echo "🔍 Verificando status do sistema..."
        docker compose -f docker-compose.prod.yml ps
        echo ""
        echo "📋 Últimos logs (últimas 20 linhas):"
        docker compose -f docker-compose.prod.yml logs autosheets --tail=20
        ;;
    4)
        echo ""
        echo "🧪 EXECUTANDO TESTE COMPLETO"
        echo "============================="
        echo ""
        
        echo "1️⃣ Verificando status do container..."
        docker compose -f docker-compose.prod.yml ps autosheets
        echo ""
        
        echo "2️⃣ Verificando se o monitor está rodando..."
        docker compose -f docker-compose.prod.yml exec autosheets ps aux | grep -E "(tsx|monitor)" || echo "❌ Monitor não encontrado"
        echo ""
        
        echo "3️⃣ Testando webhook..."
        testar_reply
        
        echo "4️⃣ Verificando logs após o teste..."
        echo "   (Aguardando 3 segundos para processar...)"
        sleep 3
        docker compose -f docker-compose.prod.yml logs autosheets --tail=10 | grep -E "(reply|betKey|Debug|processamento)"
        echo ""
        
        echo "5️⃣ Resumo do teste:"
        echo "   - Se você viu logs com 'Debug da chave' ou 'processamento', o sistema está funcionando"
        echo "   - Se não viu logs, o monitor pode não estar rodando ou conectado"
        echo "   - Para resolver, execute: docker compose -f docker-compose.prod.yml restart autosheets"
        ;;
    *)
        echo "❌ Opção inválida"
        exit 1
        ;;
esac

echo ""
echo "✅ Teste concluído!"
echo "Para mais informações, execute: ./scripts/verificar-monitor-producao.sh"