#!/bin/bash

# Script para diagnosticar erros de TypeScript no webhook
echo "🔍 DEBUG DE ERROS TYPESCRIPT"
echo "============================"
echo ""

# Verificar se o container está rodando
echo "📋 VERIFICANDO STATUS DO CONTAINER:"
echo "----------------------------------"
docker ps --filter "name=autosheets_app" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# Verificar sintaxe do arquivo route.ts
echo "🔧 VERIFICANDO SINTAXE DO ROUTE.TS:"
echo "----------------------------------"
echo "Verificando se o arquivo tem erros de sintaxe..."
docker exec autosheets_app node -c src/app/api/telegram/webhook/route.ts 2>&1 || echo "❌ Erro de sintaxe encontrado"
echo ""

# Verificar imports e dependências
echo "📦 VERIFICANDO IMPORTS E DEPENDÊNCIAS:"
echo "-------------------------------------"
echo "Imports no arquivo route.ts:"
docker exec autosheets_app grep -n "^import" src/app/api/telegram/webhook/route.ts
echo ""

echo "Verificando se os arquivos importados existem:"
echo "- @/lib/sheets/service:"
docker exec autosheets_app test -f src/lib/sheets/service.ts && echo "✅ EXISTE" || echo "❌ NÃO EXISTE"
echo "- @/lib/gemini/parser:"
docker exec autosheets_app test -f src/lib/gemini/parser.ts && echo "✅ EXISTE" || echo "❌ NÃO EXISTE"
echo "- @/lib/telegram/parser:"
docker exec autosheets_app test -f src/lib/telegram/parser.ts && echo "✅ EXISTE" || echo "❌ NÃO EXISTE"
echo "- @/lib/telegram/gramjs-monitor:"
docker exec autosheets_app test -f src/lib/telegram/gramjs-monitor.ts && echo "✅ EXISTE" || echo "❌ NÃO EXISTE"
echo "- @/lib/shared/bet-cache:"
docker exec autosheets_app test -f src/lib/shared/bet-cache.ts && echo "✅ EXISTE" || echo "❌ NÃO EXISTE"
echo ""

# Verificar se há erros de compilação TypeScript
echo "🔧 VERIFICANDO COMPILAÇÃO TYPESCRIPT:"
echo "------------------------------------"
echo "Tentando compilar o arquivo isoladamente..."
docker exec autosheets_app npx tsc --noEmit --skipLibCheck src/app/api/telegram/webhook/route.ts 2>&1 || echo "❌ Erros de TypeScript encontrados"
echo ""

# Verificar logs de build do Next.js
echo "📋 VERIFICANDO LOGS DE BUILD:"
echo "-----------------------------"
echo "Logs de build recentes (últimos 50 linhas):"
docker logs autosheets_app 2>&1 | grep -E "(error|Error|ERROR|warn|Warning|WARN|Failed|failed|compiled|ready|build)" | tail -20
echo ""

# Verificar se o Next.js está em modo de desenvolvimento
echo "🚀 VERIFICANDO MODO DE DESENVOLVIMENTO:"
echo "--------------------------------------"
echo "Processo Node.js:"
docker exec autosheets_app ps aux | grep node
echo ""
echo "Variável NODE_ENV:"
docker exec autosheets_app printenv NODE_ENV
echo ""

# Tentar forçar rebuild
echo "🔄 TENTANDO FORÇAR REBUILD:"
echo "============================"
echo "Parando o processo atual..."
docker exec autosheets_app pkill -f "next" 2>/dev/null || echo "Nenhum processo Next.js encontrado"
echo ""
echo "Limpando cache do Next.js..."
docker exec autosheets_app rm -rf .next 2>/dev/null || echo "Pasta .next não encontrada"
echo ""
echo "Iniciando Next.js em modo dev..."
docker exec -d autosheets_app npm run dev
echo "Aguardando inicialização..."
sleep 15
echo ""

# Verificar se o Next.js iniciou corretamente
echo "📊 VERIFICANDO INICIALIZAÇÃO:"
echo "-----------------------------"
echo "Status do processo:"
docker exec autosheets_app ps aux | grep -E "(next|node)" | head -3
echo ""
echo "Porta 3000:"
docker exec autosheets_app netstat -tlnp | grep :3000 || echo "❌ Porta 3000 não está ativa"
echo ""
echo "Logs de inicialização:"
docker logs autosheets_app --since 20s 2>&1 | tail -15
echo ""

# Testar a rota após rebuild
echo "🧪 TESTANDO ROTA APÓS REBUILD:"
echo "=============================="
echo "Limpando logs para teste..."
docker logs autosheets_app --tail 0 > /dev/null 2>&1
echo ""

echo "Enviando payload de teste..."
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"update_id":123,"message":{"message_id":456,"text":"teste","from":{"id":789},"chat":{"id":-123}}}' \
  http://localhost:3000/api/telegram/webhook)

echo "Resposta: $RESPONSE"
echo ""

# Verificar logs após o teste
echo "Logs após o teste:"
sleep 3
WEBHOOK_LOGS=$(docker logs autosheets_app --since 10s 2>&1)
echo "$WEBHOOK_LOGS"
echo ""

# Análise final
echo "📋 ANÁLISE FINAL:"
echo "================="

if echo "$WEBHOOK_LOGS" | grep -q "🔄 Webhook recebido"; then
    echo "✅ SUCESSO: Webhook está funcionando após rebuild!"
else
    echo "❌ PROBLEMA PERSISTE: Webhook ainda não está funcionando"
    echo ""
    echo "Possíveis causas:"
    echo "1. Erros de TypeScript não resolvidos"
    echo "2. Dependências em falta"
    echo "3. Problema de configuração do Next.js"
    echo "4. Problema de roteamento"
fi

echo ""
echo "🔧 COMANDOS PARA INVESTIGAÇÃO MANUAL:"
echo "====================================="
echo "1. Verificar erros detalhados:"
echo "   docker exec autosheets_app npm run build"
echo ""
echo "2. Verificar logs em tempo real:"
echo "   docker logs -f autosheets_app"
echo ""
echo "3. Entrar no container:"
echo "   docker exec -it autosheets_app /bin/sh"
echo ""
echo "4. Verificar dependências:"
echo "   docker exec autosheets_app npm list"
echo ""