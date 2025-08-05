#!/bin/bash

# Script para corrigir configuração do TypeScript e resolver imports
echo "🔧 CORRIGINDO CONFIGURAÇÃO TYPESCRIPT"
echo "===================================="
echo ""

# Verificar se o container está rodando
echo "📋 VERIFICANDO STATUS DO CONTAINER:"
echo "----------------------------------"
docker ps --filter "name=autosheets_app" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# Backup do tsconfig.json atual
echo "💾 FAZENDO BACKUP DO TSCONFIG.JSON:"
echo "----------------------------------"
docker exec autosheets_app cp tsconfig.json tsconfig.json.backup
echo "✅ Backup criado: tsconfig.json.backup"
echo ""

# Criar novo tsconfig.json com baseUrl
echo "🔧 CRIANDO NOVO TSCONFIG.JSON:"
echo "-----------------------------"
docker exec autosheets_app cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
EOF

echo "✅ Novo tsconfig.json criado com baseUrl"
echo ""

# Verificar se os arquivos importados existem
echo "📁 VERIFICANDO ARQUIVOS IMPORTADOS:"
echo "-----------------------------------"
echo "Verificando estrutura de pastas:"
docker exec autosheets_app find src/lib -name "*.ts" | head -10
echo ""

# Testar compilação TypeScript
echo "🔧 TESTANDO COMPILAÇÃO TYPESCRIPT:"
echo "---------------------------------"
echo "Testando compilação do webhook:"
docker exec autosheets_app npx tsc --noEmit --skipLibCheck src/app/api/telegram/webhook/route.ts 2>&1 || echo "❌ Ainda há erros de TypeScript"
echo ""

# Limpar cache do Next.js
echo "🧹 LIMPANDO CACHE DO NEXT.JS:"
echo "-----------------------------"
docker exec autosheets_app rm -rf .next
echo "✅ Cache limpo"
echo ""

# Parar processos atuais
echo "⏹️ PARANDO PROCESSOS ATUAIS:"
echo "----------------------------"
docker exec autosheets_app pkill -f "next" 2>/dev/null || echo "Nenhum processo Next.js encontrado"
docker exec autosheets_app pkill -f "npm" 2>/dev/null || echo "Nenhum processo npm encontrado"
echo ""

# Aguardar um pouco
echo "⏳ Aguardando processos pararem..."
sleep 3
echo ""

# Iniciar Next.js novamente
echo "🚀 INICIANDO NEXT.JS:"
echo "--------------------"
echo "Iniciando em modo desenvolvimento..."
docker exec -d autosheets_app npm run dev
echo "Aguardando inicialização..."
sleep 20
echo ""

# Verificar se iniciou corretamente
echo "📊 VERIFICANDO INICIALIZAÇÃO:"
echo "-----------------------------"
echo "Processos Node.js:"
docker exec autosheets_app ps aux | grep -E "(next|node)" | head -5
echo ""
echo "Porta 3000:"
docker exec autosheets_app netstat -tlnp | grep :3000 || echo "❌ Porta 3000 não está ativa"
echo ""

# Verificar logs de inicialização
echo "📋 LOGS DE INICIALIZAÇÃO:"
echo "------------------------"
docker logs autosheets_app --since 25s 2>&1 | tail -15
echo ""

# Testar o webhook após as correções
echo "🧪 TESTANDO WEBHOOK APÓS CORREÇÕES:"
echo "===================================="
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
echo "📋 LOGS APÓS O TESTE:"
echo "--------------------"
sleep 3
WEBHOOK_LOGS=$(docker logs autosheets_app --since 10s 2>&1)
echo "$WEBHOOK_LOGS"
echo ""

# Análise final
echo "📋 ANÁLISE FINAL:"
echo "================="

if echo "$WEBHOOK_LOGS" | grep -q "🔄 Webhook recebido"; then
    echo "✅ SUCESSO: Webhook está funcionando após correções!"
    echo "✅ Problema de TypeScript resolvido"
else
    echo "❌ PROBLEMA PERSISTE: Verificando possíveis causas..."
    echo ""
    
    # Verificar se há erros de compilação
    if echo "$WEBHOOK_LOGS" | grep -q -i "error\|Error\|ERROR"; then
        echo "❌ Há erros de compilação nos logs"
        echo "Erros encontrados:"
        echo "$WEBHOOK_LOGS" | grep -i "error\|Error\|ERROR" | head -5
    else
        echo "ℹ️ Não há erros visíveis nos logs"
    fi
    
    echo ""
    echo "🔧 PRÓXIMOS PASSOS:"
    echo "=================="
    echo "1. Verificar se o Next.js compilou corretamente"
    echo "2. Verificar se há outros erros de dependências"
    echo "3. Testar build de produção: docker exec autosheets_app npm run build"
fi

echo ""
echo "🔧 COMANDOS ÚTEIS:"
echo "=================="
echo "1. Ver logs em tempo real: docker logs -f autosheets_app"
echo "2. Entrar no container: docker exec -it autosheets_app /bin/sh"
echo "3. Testar build: docker exec autosheets_app npm run build"
echo "4. Restaurar backup: docker exec autosheets_app cp tsconfig.json.backup tsconfig.json"
echo ""