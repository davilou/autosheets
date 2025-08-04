#!/bin/sh
set -e

echo "🚀 Iniciando AutoSheets..."

# Verificar se as variáveis do Telegram estão configuradas
if [ -z "$TELEGRAM_API_ID" ] || [ -z "$TELEGRAM_API_HASH" ]; then
    echo "⚠️  Variáveis do Telegram não configuradas, apenas Next.js será iniciado"
    exec npm start
else
    echo "📱 Iniciando monitor do Telegram em background..."
    npm run monitor &
    MONITOR_PID=$!
    
    echo "🌐 Iniciando aplicação Next.js..."
    npm start &
    NEXTJS_PID=$!
    
    # Função para cleanup quando o container for parado
    cleanup() {
        echo "🛑 Parando serviços..."
        kill $MONITOR_PID 2>/dev/null || true
        kill $NEXTJS_PID 2>/dev/null || true
        exit 0
    }
    
    # Capturar sinais de parada
    trap cleanup SIGTERM SIGINT
    
    # Aguardar os processos
    wait $NEXTJS_PID
fi