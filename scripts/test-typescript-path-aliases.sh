#!/bin/bash

# Script para testar especificamente a resolução de path aliases do TypeScript
# após as correções no tsconfig.json e next.config.ts

echo "🔧 TESTE DE RESOLUÇÃO DE PATH ALIASES DO TYPESCRIPT"
echo "=================================================="
echo ""

# 1. Parar containers existentes
echo "🛑 PARANDO CONTAINERS EXISTENTES:"
echo "--------------------------------"
docker compose -f docker-compose.prod.yml down
echo "✅ Containers parados"
echo ""

# 2. Rebuild apenas a aplicação
echo "🔨 REBUILD DA APLICAÇÃO:"
echo "------------------------"
docker compose -f docker-compose.prod.yml build --no-cache autosheets
echo "✅ Build concluído"
echo ""

# 3. Iniciar apenas os serviços necessários
echo "🚀 INICIANDO SERVIÇOS:"
echo "----------------------"
docker compose -f docker-compose.prod.yml up -d postgres redis
echo "Aguardando banco e redis..."
sleep 10
docker compose -f docker-compose.prod.yml up -d autosheets
echo "Aguardando aplicação..."
sleep 20
echo ""

# 4. Verificar se o container está rodando
echo "📊 STATUS DO CONTAINER:"
echo "----------------------"
docker ps --filter name=autosheets_app --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# 5. Testar compilação TypeScript com diferentes abordagens
echo "🔧 TESTANDO COMPILAÇÃO TYPESCRIPT:"
echo "---------------------------------"

# Teste 1: Compilação direta do arquivo webhook
echo "📝 Teste 1: Compilação direta do webhook"
docker exec autosheets_app npx tsc --noEmit --skipLibCheck src/app/api/telegram/webhook/route.ts
TEST1_RESULT=$?
echo "Resultado: $([ $TEST1_RESULT -eq 0 ] && echo "✅ SUCESSO" || echo "❌ ERRO")"
echo ""

# Teste 2: Verificar se os módulos existem
echo "📁 Teste 2: Verificação de existência dos módulos"
echo "Verificando @/lib/sheets/service:"
docker exec autosheets_app test -f "src/lib/sheets/service.ts" && echo "✅ Existe" || echo "❌ Não existe"
echo "Verificando @/lib/gemini/parser:"
docker exec autosheets_app test -f "src/lib/gemini/parser.ts" && echo "✅ Existe" || echo "❌ Não existe"
echo "Verificando @/lib/telegram/parser:"
docker exec autosheets_app test -f "src/lib/telegram/parser.ts" && echo "✅ Existe" || echo "❌ Não existe"
echo "Verificando @/lib/telegram/gramjs-monitor:"
docker exec autosheets_app test -f "src/lib/telegram/gramjs-monitor.ts" && echo "✅ Existe" || echo "❌ Não existe"
echo "Verificando @/lib/shared/bet-cache:"
docker exec autosheets_app test -f "src/lib/shared/bet-cache.ts" && echo "✅ Existe" || echo "❌ Não existe"
echo ""

# Teste 3: Verificar tsconfig.json no container
echo "⚙️ Teste 3: Verificação do tsconfig.json"
echo "Conteúdo do tsconfig.json no container:"
docker exec autosheets_app cat tsconfig.json | jq '.compilerOptions.paths'
echo ""

# Teste 4: Testar resolução de módulos com Node.js
echo "🔍 Teste 4: Teste de resolução com Node.js"
echo "Testando import de @/lib/sheets/service:"
docker exec autosheets_app node -e "try { require('./src/lib/sheets/service.ts'); console.log('✅ Módulo encontrado'); } catch(e) { console.log('❌ Erro:', e.message); }"
echo ""

# Teste 5: Compilação completa do projeto
echo "🏗️ Teste 5: Compilação completa do Next.js"
echo "Executando npm run build:"
docker exec autosheets_app npm run build
TEST5_RESULT=$?
echo "Resultado: $([ $TEST5_RESULT -eq 0 ] && echo "✅ BUILD SUCESSO" || echo "❌ BUILD ERRO")"
echo ""

# Teste 6: Verificar se o servidor Next.js está funcionando
echo "🌐 Teste 6: Verificação do servidor Next.js"
echo "Processos Node.js:"
docker exec autosheets_app ps aux | grep node | grep -v grep
echo ""
echo "Porta 3000:"
docker exec autosheets_app netstat -tlnp | grep :3000
echo ""

# Teste 7: Teste do webhook
echo "🧪 Teste 7: Teste do webhook"
echo "Testando endpoint /api/telegram/webhook:"
RESPONSE=$(curl -s -X POST http://localhost:3000/api/telegram/webhook \
  -H "Content-Type: application/json" \
  -d '{"message":{"text":"test"}}' \
  -w "\nHTTP_CODE:%{http_code}" 2>/dev/null || echo "Erro de conexão")
echo "Resposta: $RESPONSE"
echo ""

# Teste 8: Verificar logs de erro
echo "📋 Teste 8: Logs de erro do container"
echo "Últimos logs do container:"
docker logs autosheets_app --tail 20
echo ""

# Relatório final
echo "📊 RELATÓRIO FINAL:"
echo "=================="
echo "Compilação TypeScript (webhook): $([ $TEST1_RESULT -eq 0 ] && echo "✅ OK" || echo "❌ ERRO")"
echo "Build Next.js completo: $([ $TEST5_RESULT -eq 0 ] && echo "✅ OK" || echo "❌ ERRO")"
echo "Webhook resposta HTTP: $(echo "$RESPONSE" | grep -q "HTTP_CODE:200" && echo "✅ 200 OK" || echo "❌ ERRO")"
echo ""

if [ $TEST1_RESULT -eq 0 ] && [ $TEST5_RESULT -eq 0 ]; then
    echo "🎉 SUCESSO! Os path aliases estão funcionando corretamente!"
    echo "✅ TypeScript compilando sem erros"
    echo "✅ Next.js build bem-sucedido"
else
    echo "❌ AINDA HÁ PROBLEMAS:"
    [ $TEST1_RESULT -ne 0 ] && echo "   - Erros de TypeScript na resolução de path aliases"
    [ $TEST5_RESULT -ne 0 ] && echo "   - Falha no build do Next.js"
fi
echo ""

echo "🔧 PRÓXIMOS PASSOS (se necessário):"
echo "===================================="
echo "1. Ver logs completos: docker logs -f autosheets_app"
echo "2. Entrar no container: docker exec -it autosheets_app /bin/sh"
echo "3. Verificar tsconfig: docker exec autosheets_app cat tsconfig.json"
echo "4. Testar imports manualmente: docker exec autosheets_app node -e \"console.log(require.resolve('./src/lib/sheets/service'))\""
echo ""