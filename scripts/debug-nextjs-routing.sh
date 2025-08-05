#!/bin/bash

# Script para diagnosticar problemas de roteamento do Next.js
echo "🔍 DEBUG DO ROTEAMENTO NEXT.JS"
echo "=============================="
echo ""

# Verificar se o container está rodando
echo "📋 VERIFICANDO STATUS DO CONTAINER:"
echo "----------------------------------"
docker ps --filter "name=autosheets_app" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# Verificar se o arquivo route.ts existe e seu conteúdo
echo "📁 VERIFICANDO ARQUIVO ROUTE.TS:"
echo "-------------------------------"
echo "Arquivo existe:"
docker exec autosheets_app ls -la src/app/api/telegram/webhook/route.ts
echo ""
echo "Primeiras linhas do arquivo:"
docker exec autosheets_app head -20 src/app/api/telegram/webhook/route.ts
echo ""

# Verificar se há erros de compilação
echo "🔧 VERIFICANDO COMPILAÇÃO:"
echo "--------------------------"
echo "Logs de compilação recentes:"
docker logs autosheets_app --since 5m 2>&1 | grep -E "(error|Error|ERROR|warn|Warning|WARN|compiled|ready)" | tail -10
echo ""

# Verificar se o Next.js está rodando
echo "🚀 VERIFICANDO STATUS DO NEXT.JS:"
echo "--------------------------------"
echo "Processo Next.js:"
docker exec autosheets_app ps aux | grep -E "(next|node)" | head -5
echo ""

# Verificar se a porta 3000 está sendo usada
echo "🌐 VERIFICANDO PORTA 3000:"
echo "--------------------------"
echo "Porta 3000 no container:"
docker exec autosheets_app netstat -tlnp | grep :3000 || echo "❌ Porta 3000 não está sendo usada"
echo ""

# Testar rota diretamente no container
echo "🧪 TESTANDO ROTA DIRETAMENTE NO CONTAINER:"
echo "=========================================="
echo "Teste 1: GET na rota (deve dar 405 Method Not Allowed):"
docker exec autosheets_app curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost:3000/api/telegram/webhook
echo ""
echo ""

echo "Teste 2: POST vazio na rota:"
docker exec autosheets_app curl -s -w "\nHTTP_CODE:%{http_code}" -X POST -H "Content-Type: application/json" -d '{}' http://localhost:3000/api/telegram/webhook
echo ""
echo ""

# Verificar outras rotas da API
echo "🔍 VERIFICANDO OUTRAS ROTAS DA API:"
echo "----------------------------------"
echo "Estrutura da pasta api:"
docker exec autosheets_app find src/app/api -name "*.ts" -o -name "*.js" | head -10
echo ""

# Testar uma rota simples
echo "Teste de rota raiz da API:"
docker exec autosheets_app curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost:3000/api
echo ""
echo ""

# Verificar variáveis de ambiente
echo "🔧 VERIFICANDO VARIÁVEIS DE AMBIENTE:"
echo "------------------------------------"
echo "NODE_ENV:"
docker exec autosheets_app printenv NODE_ENV || echo "❌ NODE_ENV não definida"
echo "PORT:"
docker exec autosheets_app printenv PORT || echo "❌ PORT não definida"
echo ""

# Verificar se há arquivos .next
echo "📦 VERIFICANDO BUILD DO NEXT.JS:"
echo "-------------------------------"
echo "Pasta .next existe:"
docker exec autosheets_app ls -la .next/ 2>/dev/null | head -5 || echo "❌ Pasta .next não encontrada"
echo ""
echo "Arquivos de build:"
docker exec autosheets_app find .next -name "*.js" 2>/dev/null | grep -E "(api|webhook)" | head -5 || echo "❌ Arquivos de build da API não encontrados"
echo ""

# Reiniciar o container e testar novamente
echo "🔄 REINICIANDO CONTAINER PARA TESTE:"
echo "-----------------------------------"
echo "Reiniciando container..."
docker restart autosheets_app
echo "Aguardando container ficar pronto..."
sleep 10

# Verificar se ficou saudável
echo "Status após reinicialização:"
docker ps --filter "name=autosheets_app" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# Testar novamente após reinicialização
echo "🧪 TESTE APÓS REINICIALIZAÇÃO:"
echo "=============================="
echo "Limpando logs..."
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
sleep 2
docker logs autosheets_app --since 5s 2>&1 | tail -10
echo ""

echo "📋 RESUMO DO DIAGNÓSTICO:"
echo "========================"
echo "- Container status: $(docker ps --filter 'name=autosheets_app' --format '{{.Status}}' | head -1)"
echo "- Arquivo route.ts: $(docker exec autosheets_app test -f src/app/api/telegram/webhook/route.ts && echo 'EXISTE' || echo 'NÃO EXISTE')"
echo "- Porta 3000: $(docker exec autosheets_app netstat -tlnp | grep :3000 > /dev/null && echo 'ATIVA' || echo 'INATIVA')"
echo "- Pasta .next: $(docker exec autosheets_app test -d .next && echo 'EXISTE' || echo 'NÃO EXISTE')"
echo ""
echo "🔧 PRÓXIMOS PASSOS:"
echo "=================="
echo "1. Se a porta 3000 não estiver ativa, há problema no Next.js"
echo "2. Se a pasta .next não existir, há problema de build"
echo "3. Se os logs não aparecerem, há problema de roteamento"
echo "4. Verificar se há erros de TypeScript no código"
echo ""