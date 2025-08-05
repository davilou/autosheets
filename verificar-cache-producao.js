/**
 * Script para verificar o cache e monitor em produção
 * Este script irá simular uma aposta no cache e testar o reply
 */

const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });

const PRODUCTION_URL = 'https://autosheets.loudigital.shop';
const USER_ID = process.env.YOUR_USER_ID;

console.log('🔍 VERIFICAÇÃO ESPECÍFICA DO CACHE EM PRODUÇÃO');
console.log('='.repeat(60));
console.log('');

// Função para fazer requisições HTTPS
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// 1. Criar uma aposta de teste no cache via API
async function criarApostaTesteProdução() {
  console.log('1️⃣ CRIANDO APOSTA DE TESTE NO CACHE');
  console.log('-'.repeat(40));
  
  try {
    const url = `${PRODUCTION_URL}/api/test/create-bet`;
    const betData = {
      userId: USER_ID,
      messageId: '999999',
      betKey: `${USER_ID}_999999`,
      timestamp: Date.now(),
      chatId: USER_ID,
      originalMessage: 'Teste de aposta para diagnóstico'
    };
    
    console.log('📤 Enviando dados da aposta:');
    console.log('   Chave:', betData.betKey);
    console.log('   User ID:', betData.userId);
    console.log('   Message ID:', betData.messageId);
    
    const response = await makeRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(betData)
    });
    
    console.log('📊 Status:', response.statusCode);
    console.log('📋 Resposta:', response.body);
    
    if (response.statusCode === 200) {
      console.log('✅ Aposta criada no cache');
      return true;
    } else {
      console.log('❌ Falha ao criar aposta no cache');
      return false;
    }
  } catch (error) {
    console.log('❌ Erro ao criar aposta:', error.message);
    console.log('⚠️ Endpoint /api/test/create-bet pode não existir');
    return false;
  }
}

// 2. Testar reply com a aposta criada
async function testarReplyComAposta() {
  console.log('\n2️⃣ TESTANDO REPLY COM APOSTA NO CACHE');
  console.log('-'.repeat(40));
  
  try {
    const url = `${PRODUCTION_URL}/api/telegram/webhook`;
    const replyPayload = {
      update_id: 999999997,
      message: {
        message_id: 3000,
        from: {
          id: parseInt(USER_ID),
          is_bot: false,
          first_name: 'Teste Cache'
        },
        chat: {
          id: parseInt(USER_ID),
          type: 'private'
        },
        date: Math.floor(Date.now() / 1000),
        text: '2.15',
        reply_to_message: {
          message_id: 999999,
          from: {
            id: 7487941746,
            is_bot: true,
            first_name: 'AutoSheets'
          },
          chat: {
            id: parseInt(USER_ID),
            type: 'private'
          },
          date: Math.floor(Date.now() / 1000) - 60,
          text: 'Mensagem do bot para teste de cache'
        }
      }
    };
    
    console.log('📤 Enviando reply para aposta no cache...');
    console.log('🔑 Chave esperada:', `${USER_ID}_999999`);
    console.log('💰 Odd enviada: 2.15');
    
    const response = await makeRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(replyPayload)
    });
    
    console.log('📊 Status:', response.statusCode);
    console.log('📋 Resposta:', response.body);
    
    try {
      const responseData = JSON.parse(response.body);
      
      if (responseData.processed === true) {
        console.log('✅ Reply processado com sucesso!');
        console.log('✅ Aposta foi encontrada no cache e processada');
        return true;
      } else if (responseData.processed === false) {
        console.log('❌ Reply recebido mas aposta não encontrada no cache');
        console.log('⚠️ Possíveis causas:');
        console.log('   - Cache não está sendo compartilhado entre processos');
        console.log('   - Monitor GramJS não está salvando apostas');
        console.log('   - Problema na geração da chave betKey');
        return false;
      }
    } catch (parseError) {
      console.log('⚠️ Resposta não é JSON válido');
      return false;
    }
  } catch (error) {
    console.log('❌ Erro ao testar reply:', error.message);
    return false;
  }
}

// 3. Verificar status do cache
async function verificarStatusCache() {
  console.log('\n3️⃣ VERIFICANDO STATUS DO CACHE');
  console.log('-'.repeat(40));
  
  try {
    const url = `${PRODUCTION_URL}/api/test/cache-status`;
    
    const response = await makeRequest(url);
    
    console.log('📊 Status:', response.statusCode);
    console.log('📋 Resposta:', response.body);
    
    if (response.statusCode === 200) {
      const data = JSON.parse(response.body);
      console.log('📊 Informações do cache:');
      console.log('   Apostas ativas:', data.activeBets || 'N/A');
      console.log('   Última atualização:', data.lastUpdate || 'N/A');
      console.log('   Monitor conectado:', data.monitorConnected || 'N/A');
      return true;
    } else {
      console.log('❌ Endpoint de status do cache não disponível');
      return false;
    }
  } catch (error) {
    console.log('❌ Erro ao verificar cache:', error.message);
    console.log('⚠️ Endpoint /api/test/cache-status pode não existir');
    return false;
  }
}

// 4. Instruções detalhadas para depuração
function mostrarInstrucoesDepuracao() {
  console.log('\n4️⃣ INSTRUÇÕES DETALHADAS PARA DEPURAÇÃO');
  console.log('-'.repeat(40));
  
  console.log('🔧 COMANDOS PARA EXECUTAR NO SERVIDOR:');
  console.log('');
  
  console.log('# 1. Verificar se todos os containers estão rodando:');
  console.log('docker-compose -f docker-compose.prod.yml ps');
  console.log('');
  
  console.log('# 2. Verificar logs do monitor GramJS:');
  console.log('docker-compose -f docker-compose.prod.yml logs gramjs-monitor | tail -50');
  console.log('');
  
  console.log('# 3. Verificar se o cache existe e tem conteúdo:');
  console.log('docker-compose -f docker-compose.prod.yml exec autosheets ls -la .bet-cache.json');
  console.log('docker-compose -f docker-compose.prod.yml exec autosheets cat .bet-cache.json | jq .');
  console.log('');
  
  console.log('# 4. Verificar logs de webhook em tempo real:');
  console.log('docker-compose -f docker-compose.prod.yml logs -f autosheets | grep -E "(webhook|reply|betKey)"');
  console.log('');
  
  console.log('# 5. Verificar variáveis de ambiente críticas:');
  console.log('docker-compose -f docker-compose.prod.yml exec autosheets env | grep -E "(TELEGRAM|REDIS|YOUR_USER_ID)"');
  console.log('');
  
  console.log('# 6. Testar conectividade Redis (se usado):');
  console.log('docker-compose -f docker-compose.prod.yml exec autosheets node -e "const Redis = require(\'ioredis\'); const redis = new Redis(process.env.REDIS_URL); redis.ping().then(console.log).catch(console.error);"');
  console.log('');
  
  console.log('# 7. Reiniciar apenas o monitor (se necessário):');
  console.log('docker-compose -f docker-compose.prod.yml restart gramjs-monitor');
  console.log('');
  
  console.log('# 8. Verificar se o webhook está recebendo updates:');
  console.log('docker-compose -f docker-compose.prod.yml logs autosheets | grep "POST /api/telegram/webhook" | tail -10');
  console.log('');
  
  console.log('🔍 PONTOS CRÍTICOS PARA VERIFICAR:');
  console.log('');
  console.log('1. O monitor GramJS está conectado e funcionando?');
  console.log('2. As apostas estão sendo salvas no cache quando detectadas?');
  console.log('3. A chave betKey está sendo gerada corretamente (userId_messageId)?');
  console.log('4. O cache está sendo compartilhado entre o monitor e o webhook?');
  console.log('5. As variáveis de ambiente estão corretas em produção?');
  console.log('');
  
  console.log('💡 DICAS DE DEPURAÇÃO:');
  console.log('');
  console.log('- Se o monitor não estiver detectando apostas, verifique MONITORED_CHAT_IDS');
  console.log('- Se apostas são detectadas mas não processadas, problema no cache compartilhado');
  console.log('- Se webhook não recebe updates, problema na configuração do Telegram');
  console.log('- Se tudo parece OK mas não funciona, pode ser problema de timing/sincronização');
}

// Executar verificação completa
async function executarVerificacao() {
  console.log('🚀 Iniciando verificação específica do cache...');
  console.log('');
  
  // Tentar criar aposta de teste
  const apostaCreated = await criarApostaTesteProdução();
  
  // Testar reply
  const replyProcessed = await testarReplyComAposta();
  
  // Verificar status do cache
  const cacheStatus = await verificarStatusCache();
  
  // Mostrar instruções
  mostrarInstrucoesDepuracao();
  
  console.log('\n📊 RESUMO DA VERIFICAÇÃO');
  console.log('='.repeat(60));
  console.log('Criação de aposta teste:', apostaCreated ? '✅' : '❌');
  console.log('Processamento de reply:', replyProcessed ? '✅' : '❌');
  console.log('Status do cache:', cacheStatus ? '✅' : '❌');
  
  if (!apostaCreated && !replyProcessed && !cacheStatus) {
    console.log('\n🚨 PROBLEMA CRÍTICO:');
    console.log('   Nenhum endpoint de teste está disponível.');
    console.log('   Você precisa verificar manualmente no servidor.');
    console.log('   Execute os comandos listados acima.');
  } else if (apostaCreated && replyProcessed) {
    console.log('\n🎉 CACHE FUNCIONANDO!');
    console.log('   O problema pode estar no monitor GramJS não detectando apostas reais.');
  } else if (apostaCreated && !replyProcessed) {
    console.log('\n🔍 PROBLEMA NO PROCESSAMENTO:');
    console.log('   Apostas podem ser criadas mas não processadas.');
    console.log('   Verifique se o cache está sendo compartilhado corretamente.');
  }
  
  console.log('\n📝 Próximos passos: Execute os comandos de depuração no servidor.');
}

// Executar
executarVerificacao().catch(console.error);