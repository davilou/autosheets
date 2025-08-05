/**
 * Script para simular uma aposta real sendo detectada e processada
 * Este script replica exatamente o fluxo de uma aposta real
 */

const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });

const PRODUCTION_URL = 'https://autosheets.loudigital.shop';
const USER_ID = process.env.YOUR_USER_ID;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

console.log('🎯 SIMULAÇÃO DE APOSTA REAL EM PRODUÇÃO');
console.log('='.repeat(60));
console.log('');
console.log('📋 Configurações:');
console.log('   URL Produção:', PRODUCTION_URL);
console.log('   User ID:', USER_ID);
console.log('   Bot Token:', BOT_TOKEN ? 'Configurado' : 'NÃO CONFIGURADO');
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

// 1. Simular detecção de aposta (como se fosse o monitor GramJS)
async function simularDeteccaoAposta() {
  console.log('1️⃣ SIMULANDO DETECÇÃO DE APOSTA (Monitor GramJS)');
  console.log('-'.repeat(50));
  
  const messageId = Math.floor(Date.now() / 1000); // ID único baseado em timestamp
  const betKey = `${USER_ID}_${messageId}`;
  
  console.log('📨 Aposta detectada:');
  console.log('   Message ID:', messageId);
  console.log('   Bet Key:', betKey);
  console.log('   Timestamp:', new Date().toISOString());
  
  // Simular o que o monitor faria: salvar no cache
  const apostaData = {
    userId: USER_ID,
    messageId: messageId,
    betKey: betKey,
    timestamp: Date.now(),
    chatId: USER_ID,
    originalMessage: 'Aposta simulada para teste de produção',
    detected: true
  };
  
  console.log('💾 Dados que seriam salvos no cache:');
  console.log(JSON.stringify(apostaData, null, 2));
  
  return { messageId, betKey, apostaData };
}

// 2. Simular webhook recebendo update de mensagem normal
async function simularWebhookMensagemNormal(messageId) {
  console.log('\n2️⃣ SIMULANDO WEBHOOK - MENSAGEM NORMAL');
  console.log('-'.repeat(50));
  
  try {
    const url = `${PRODUCTION_URL}/api/telegram/webhook`;
    const normalPayload = {
      update_id: Math.floor(Math.random() * 1000000),
      message: {
        message_id: messageId,
        from: {
          id: 7487941746, // ID do bot
          is_bot: true,
          first_name: 'AutoSheets'
        },
        chat: {
          id: parseInt(USER_ID),
          type: 'private'
        },
        date: Math.floor(Date.now() / 1000),
        text: 'Esta é uma mensagem que deveria ser detectada como aposta'
      }
    };
    
    console.log('📤 Enviando mensagem normal (que seria detectada como aposta):');
    console.log('   Message ID:', messageId);
    console.log('   From Bot:', normalPayload.message.from.first_name);
    console.log('   Text:', normalPayload.message.text);
    
    const response = await makeRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(normalPayload)
    });
    
    console.log('📊 Status:', response.statusCode);
    console.log('📋 Resposta:', response.body);
    
    return response.statusCode === 200;
  } catch (error) {
    console.log('❌ Erro ao simular mensagem normal:', error.message);
    return false;
  }
}

// 3. Aguardar um pouco (simular tempo real)
function aguardar(segundos) {
  console.log(`\n⏳ Aguardando ${segundos} segundos (simulando tempo real)...`);
  return new Promise(resolve => setTimeout(resolve, segundos * 1000));
}

// 4. Simular reply do usuário
async function simularReplyUsuario(messageId, betKey) {
  console.log('\n3️⃣ SIMULANDO REPLY DO USUÁRIO');
  console.log('-'.repeat(50));
  
  try {
    const url = `${PRODUCTION_URL}/api/telegram/webhook`;
    const replyPayload = {
      update_id: Math.floor(Math.random() * 1000000),
      message: {
        message_id: Math.floor(Math.random() * 1000000),
        from: {
          id: parseInt(USER_ID),
          is_bot: false,
          first_name: 'Usuário Teste'
        },
        chat: {
          id: parseInt(USER_ID),
          type: 'private'
        },
        date: Math.floor(Date.now() / 1000),
        text: '1.75', // Odd do usuário
        reply_to_message: {
          message_id: messageId,
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
          text: 'Esta é uma mensagem que deveria ser detectada como aposta'
        }
      }
    };
    
    console.log('📤 Enviando reply do usuário:');
    console.log('   Odd informada: 1.75');
    console.log('   Reply para Message ID:', messageId);
    console.log('   Bet Key esperada:', betKey);
    
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
        console.log('✅ SUCESSO: Reply foi processado!');
        console.log('✅ Aposta foi encontrada no cache e processada');
        return true;
      } else if (responseData.processed === false) {
        console.log('❌ FALHA: Reply recebido mas aposta não encontrada');
        console.log('🔍 Possíveis causas:');
        console.log('   1. Monitor GramJS não está salvando apostas no cache');
        console.log('   2. Cache não está sendo compartilhado entre processos');
        console.log('   3. Chave betKey não está sendo gerada corretamente');
        console.log('   4. Aposta expirou ou foi removida do cache');
        return false;
      } else {
        console.log('⚠️ Resposta inesperada:', responseData);
        return false;
      }
    } catch (parseError) {
      console.log('⚠️ Resposta não é JSON válido');
      return false;
    }
  } catch (error) {
    console.log('❌ Erro ao simular reply:', error.message);
    return false;
  }
}

// 5. Verificar logs específicos
async function verificarLogsEspecificos(betKey) {
  console.log('\n4️⃣ VERIFICAÇÃO DE LOGS ESPECÍFICOS');
  console.log('-'.repeat(50));
  
  console.log('🔍 Para verificar se a aposta foi detectada, execute:');
  console.log(`docker-compose -f docker-compose.prod.yml logs autosheets | grep "${betKey}"`);
  console.log('');
  
  console.log('🔍 Para verificar logs do monitor GramJS:');
  console.log('docker-compose -f docker-compose.prod.yml logs gramjs-monitor | tail -20');
  console.log('');
  
  console.log('🔍 Para verificar se o cache tem a aposta:');
  console.log('docker-compose -f docker-compose.prod.yml exec autosheets cat .bet-cache.json | jq .');
  console.log('');
  
  console.log('🔍 Para verificar logs de webhook em tempo real:');
  console.log('docker-compose -f docker-compose.prod.yml logs -f autosheets');
}

// 6. Diagnóstico final
function diagnosticoFinal(resultados) {
  console.log('\n📊 DIAGNÓSTICO FINAL');
  console.log('='.repeat(60));
  
  console.log('Simulação de detecção:', '✅');
  console.log('Webhook mensagem normal:', resultados.webhookNormal ? '✅' : '❌');
  console.log('Processamento de reply:', resultados.replyProcessado ? '✅' : '❌');
  
  console.log('\n🎯 CONCLUSÕES:');
  
  if (!resultados.webhookNormal) {
    console.log('❌ PROBLEMA CRÍTICO: Webhook não está funcionando');
    console.log('   - Verifique se a aplicação está rodando');
    console.log('   - Verifique se nginx está configurado corretamente');
    console.log('   - Verifique se não há erros nos logs da aplicação');
  } else if (!resultados.replyProcessado) {
    console.log('❌ PROBLEMA NO CACHE: Webhook funciona mas replies não são processados');
    console.log('   - O monitor GramJS pode não estar detectando apostas');
    console.log('   - O cache pode não estar sendo compartilhado');
    console.log('   - As chaves betKey podem estar sendo geradas incorretamente');
    console.log('');
    console.log('🔧 PRÓXIMOS PASSOS:');
    console.log('   1. Verificar se o monitor GramJS está rodando');
    console.log('   2. Verificar se apostas estão sendo salvas no cache');
    console.log('   3. Verificar se as variáveis MONITORED_CHAT_IDS estão corretas');
    console.log('   4. Verificar se o cache está sendo compartilhado entre processos');
  } else {
    console.log('✅ TUDO FUNCIONANDO: O problema pode estar na detecção real de apostas');
    console.log('   - Verifique se o monitor está conectado aos chats corretos');
    console.log('   - Verifique se as mensagens estão sendo detectadas como apostas');
    console.log('   - Verifique os logs do monitor GramJS para ver se detecta mensagens');
  }
  
  console.log('\n📝 COMANDOS ESSENCIAIS PARA EXECUTAR NO SERVIDOR:');
  console.log('docker-compose -f docker-compose.prod.yml ps');
  console.log('docker-compose -f docker-compose.prod.yml logs gramjs-monitor | tail -20');
  console.log('docker-compose -f docker-compose.prod.yml exec autosheets cat .bet-cache.json');
  console.log('docker-compose -f docker-compose.prod.yml logs autosheets | grep -E "(betKey|reply|webhook)" | tail -20');
}

// Executar simulação completa
async function executarSimulacao() {
  console.log('🚀 Iniciando simulação completa de aposta real...');
  console.log('');
  
  // 1. Simular detecção
  const { messageId, betKey, apostaData } = await simularDeteccaoAposta();
  
  // 2. Simular webhook recebendo mensagem normal
  const webhookNormal = await simularWebhookMensagemNormal(messageId);
  
  // 3. Aguardar um pouco
  await aguardar(2);
  
  // 4. Simular reply
  const replyProcessado = await simularReplyUsuario(messageId, betKey);
  
  // 5. Verificar logs
  await verificarLogsEspecificos(betKey);
  
  // 6. Diagnóstico final
  diagnosticoFinal({
    webhookNormal,
    replyProcessado
  });
}

// Executar
executarSimulacao().catch(console.error);