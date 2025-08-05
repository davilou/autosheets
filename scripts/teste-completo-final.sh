#!/bin/bash

# 🎯 TESTE COMPLETO FINAL - Sistema de Replies
# Executa todos os testes necessários para validar o funcionamento completo

echo "🚀 ===== TESTE COMPLETO FINAL DO SISTEMA DE REPLIES ====="
echo "📅 $(date)"
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para logs coloridos
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

echo "🔍 ===== FASE 1: VERIFICAÇÃO DE INFRAESTRUTURA ====="
echo ""

# 1. Verificar serviços Docker
log_info "Verificando status dos serviços Docker..."
docker compose -f docker-compose.prod.yml ps
echo ""

# 2. Verificar nginx especificamente
log_info "Status detalhado do nginx:"
nginx_status=$(docker compose -f docker-compose.prod.yml ps nginx --format "table {{.Service}}\t{{.State}}\t{{.Status}}")
echo "$nginx_status"

if echo "$nginx_status" | grep -q "Up"; then
    log_success "Nginx está funcionando"
else
    log_error "Nginx com problemas"
fi
echo ""

# 3. Testar conectividade do webhook
log_info "Testando conectividade do webhook..."
webhook_response=$(curl -s -o /dev/null -w "%{http_code}" https://autosheets.loudigital.shop/api/telegram/webhook)
echo "Código de resposta: $webhook_response"

if [ "$webhook_response" = "405" ]; then
    log_success "Webhook respondendo corretamente (405 = método não permitido, esperado)"
elif [ "$webhook_response" = "200" ]; then
    log_success "Webhook respondendo (200)"
else
    log_error "Webhook não está respondendo corretamente (código: $webhook_response)"
fi
echo ""

echo "📊 ===== FASE 2: VERIFICAÇÃO DO CACHE E MONITOR ====="
echo ""

# 4. Verificar cache de apostas
log_info "Verificando cache de apostas..."
if [ -f ".bet-cache.json" ]; then
    cache_content=$(cat .bet-cache.json)
    bet_count=$(echo "$cache_content" | jq 'length' 2>/dev/null || echo "0")
    log_success "Cache encontrado com $bet_count apostas"
    
    if [ "$bet_count" -gt 0 ]; then
        echo "📋 Apostas no cache:"
        echo "$cache_content" | jq -r 'keys[]' 2>/dev/null || echo "$cache_content"
        echo ""
        
        # Pegar primeira chave para teste
        first_key=$(echo "$cache_content" | jq -r 'keys[0]' 2>/dev/null)
        if [ "$first_key" != "null" ] && [ "$first_key" != "" ]; then
            log_info "Chave de teste selecionada: $first_key"
            TEST_KEY="$first_key"
        fi
    else
        log_warning "Cache vazio - aguardando nova aposta para teste"
    fi
else
    log_error "Cache não encontrado"
fi
echo ""

# 5. Verificar logs recentes do monitor
log_info "Verificando atividade recente do monitor (últimas 20 linhas)..."
recent_logs=$(docker compose -f docker-compose.prod.yml logs --tail=20 autosheets 2>/dev/null)
echo "$recent_logs" | grep -E "(🎯|💾|📤|🔗)" | tail -5
echo ""

echo "🧪 ===== FASE 3: TESTE DE WEBHOOK MANUAL ====="
echo ""

if [ -n "$TEST_KEY" ]; then
    log_info "Executando teste manual com chave: $TEST_KEY"
    
    # Extrair userId e messageId da chave
    userId=$(echo "$TEST_KEY" | cut -d'_' -f1)
    messageId=$(echo "$TEST_KEY" | cut -d'_' -f2)
    
    log_info "UserId: $userId, MessageId: $messageId"
    
    # Construir payload de teste
    test_payload=$(cat <<EOF
{
  "message": {
    "message_id": $messageId,
    "from": {
      "id": $userId,
      "first_name": "TestUser"
    },
    "chat": {
      "id": $userId,
      "type": "private"
    },
    "date": $(date +%s),
    "text": "1.85",
    "reply_to_message": {
      "message_id": $messageId,
      "from": {
        "id": 7506384797,
        "is_bot": true,
        "first_name": "AutoSheets"
      },
      "chat": {
        "id": $userId,
        "type": "private"
      },
      "date": $(date +%s),
      "text": "Teste de reply"
    }
  }
}
EOF
    )
    
    echo "📤 Enviando payload de teste..."
    echo "$test_payload" | jq .
    echo ""
    
    # Enviar para webhook
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$test_payload" \
        https://autosheets.loudigital.shop/api/telegram/webhook)
    
    echo "📥 Resposta do webhook:"
    echo "$response"
    echo ""
    
    # Aguardar processamento
    log_info "Aguardando 3 segundos para processamento..."
    sleep 3
    
    # Verificar se a aposta foi removida do cache
    log_info "Verificando se a aposta foi processada (removida do cache)..."
    if [ -f ".bet-cache.json" ]; then
        new_cache=$(cat .bet-cache.json)
        if echo "$new_cache" | jq -e ".\"$TEST_KEY\"" >/dev/null 2>&1; then
            log_warning "Aposta ainda está no cache - pode não ter sido processada"
        else
            log_success "Aposta removida do cache - processamento bem-sucedido!"
        fi
    fi
    
else
    log_warning "Nenhuma aposta no cache para testar. Aguarde uma nova aposta ser detectada."
fi
echo ""

echo "📊 ===== FASE 4: MONITORAMENTO EM TEMPO REAL ====="
echo ""

log_info "Iniciando monitoramento em tempo real por 30 segundos..."
log_info "Procurando por: replies, processamento, cache, erros"
echo "" 

# Monitorar logs em tempo real por 30 segundos
timeout 30s docker compose -f docker-compose.prod.yml logs -f autosheets 2>/dev/null | \
    grep -E "(💰|reply|betKey|cache|erro|error|Processando|✅|❌)" || true

echo ""
log_info "Monitoramento concluído."
echo ""

echo "📋 ===== FASE 5: RELATÓRIO FINAL ====="
echo ""

# Status final do cache
log_info "Status final do cache:"
if [ -f ".bet-cache.json" ]; then
    final_cache=$(cat .bet-cache.json)
    final_count=$(echo "$final_cache" | jq 'length' 2>/dev/null || echo "0")
    echo "📊 Cache contém $final_count apostas"
    if [ "$final_count" -gt 0 ]; then
        echo "🔑 Chaves: $(echo "$final_cache" | jq -r 'keys[]' 2>/dev/null | tr '\n' ' ')"
    fi
else
    echo "❌ Cache não encontrado"
fi
echo ""

# Verificar logs de erro recentes
log_info "Verificando erros recentes..."
error_logs=$(docker compose -f docker-compose.prod.yml logs --tail=50 autosheets 2>/dev/null | grep -i error | tail -3)
if [ -n "$error_logs" ]; then
    log_warning "Erros encontrados:"
    echo "$error_logs"
else
    log_success "Nenhum erro recente encontrado"
fi
echo ""

echo "🎯 ===== CONCLUSÃO DO TESTE ====="
echo ""

log_info "Teste completo finalizado em $(date)"
echo ""
echo "📋 PRÓXIMOS PASSOS:"
echo "1. Se o teste manual funcionou: ✅ Sistema operacional"
echo "2. Se houve problemas: Verificar logs detalhados"
echo "3. Teste real: Responder mensagem no Telegram"
echo "4. Monitorar: docker compose -f docker-compose.prod.yml logs -f autosheets"
echo ""
echo "🔗 Para teste real no Telegram:"
echo "   - Acesse o chat privado com o bot"
echo "   - Responda à última mensagem de aposta"
echo "   - Digite uma odd (ex: 1.85)"
echo "   - Verifique se recebe confirmação"
echo ""
log_success "Teste completo concluído!"