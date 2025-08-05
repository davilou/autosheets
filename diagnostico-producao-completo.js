/**
 * Script de Diagnóstico Completo para Ambiente de Produção
 * Este script irá identificar exatamente onde está o problema com replies
 */

const https = require('https');
const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });

const PRODUCTION_URL = 'https://autosheets.loudigital.shop';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const USER_ID = process.env.YOUR_USER_ID;

console.log('🔍 DIAGNÓSTICO COMPLETO - AMBIENTE DE PRODUÇÃO');
console.log('='.repeat(60));
console.log('');

// Função para fazer requisições HTTPS
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;
    
    const req = client.request(url, options, (res) => {
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

// 1. Verificar se o webhook está configurado corretamente
async function verificarWebhook() {
  console.log('1️⃣ VERIFICANDO CONFIGURAÇÃO DO WEBHOOK');
  console.log('-'.repeat(40));
  
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`;
    const response = await makeRequest(url);
    const data = JSON.parse(response.body);
    
    console.log('📊 Status da requisição:', response.statusCode);
    console.log('📋 Informações do webhook:');
    console.log('   URL:', data.result.url || 'NÃO CONFIGURADO');
    console.log('   Pending updates:', data.result.pending_update_count || 0);
    console.log('   Last error:', data.result.last_error_message || 'Nenhum');
    console.log('   Last error date:', data.result.last_error_date ? new Date(data.result.last_error_date * 1000) : 'N/A');
    
    if (data.result.url !== `${PRODUCTION_URL}/api/telegram/webhook`) {
      console.log('❌ PROBLEMA: Webhook não está configurado para a URL correta!');
      console.log('   Esperado:', `${PRODUCTION_URL}/api/telegram/webhook`);
      console.log('   Atual:', data.result.url);
      return false;
    }
    
    if (data.result.pending_update_count > 0) {
      console.log('⚠️ ATENÇÃO: Existem', data.result.pending_update_count, 'updates pendentes');
      return false;
    }
    
    console.log('✅ Webhook configurado corretamente');
    return true;
  } catch (error) {
    console.log('❌ Erro ao verificar webhook:', error.message);
    return false;
  }
}

// 2. Testar conectividade com o webhook
async function testarConectividade() {
  console.log('\n2️⃣ TESTANDO CONECTIVIDADE DO WEBHOOK');
  console.log('-'.repeat(40));
  
  try {
    const url = `${PRODUCTION_URL}/api/telegram/webhook`;
    const testPayload = {
      update_id: 999999999,
      message: {
        message_id: 1,
        from: { id: parseInt(USER_ID), first_name: 'Teste' },
        chat: { id: parseInt(USER_ID), type: 'private' },
        date: Math.floor(Date.now() / 1000),
        text: 'teste conectividade'
      }
    };
    
    const response = await makeRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    });
    
    console.log('📊 Status da resposta:', response.statusCode);
    console.log('📋 Resposta:', response.body);
    
    if (response.statusCode === 200) {
      console.log('✅ Webhook está respondendo');
      return true;
    } else {
      console.log('❌ Webhook não está respondendo corretamente');
      return false;
    }
  } catch (error) {
    console.log('❌ Erro ao testar conectividade:', error.message);
    return false;
  }
}

// 3. Testar processamento de reply
async function testarReply() {
  console.log('\n3️⃣ TESTANDO PROCESSAMENTO DE REPLY');
  console.log('-'.repeat(40));
  
  try {
    const url = `${PRODUCTION_URL}/api/telegram/webhook`;
    const replyPayload = {
      update_id: 999999998,
      message: {
        message_id: 2000,
        from: {
          id: parseInt(USER_ID),
          is_bot: false,
          first_name: 'Teste Diagnóstico'
        },
        chat: {
          id: parseInt(USER_ID),
          type: 'private'
        },
        date: Math.floor(Date.now() / 1000),
        text: '1.85',
        reply_to_message: {
          message_id: 123,
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
          text: 'Mensagem do bot para teste'
        }
      }
    };
    
    console.log('📤 Enviando payload de reply...');
    console.log('🔑 Chave esperada:', `${USER_ID}_123`);
    
    const response = await makeRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(replyPayload)
    });
    
    console.log('📊 Status da resposta:', response.statusCode);
    console.log('📋 Resposta:', response.body);
    
    const responseData = JSON.parse(response.body);
    
    if (responseData.processed === true) {
      console.log('✅ Reply foi processado com sucesso!');
      return true;
    } else if (responseData.processed === false) {
      console.log('⚠️ Reply foi recebido mas não processado (aposta não encontrada no cache)');
      return false;
    } else {
      console.log('❌ Resposta inesperada do webhook');
      return false;
    }
  } catch (error) {
    console.log('❌ Erro ao testar reply:', error.message);
    return false;
  }
}

// 4. Verificar logs do container (simulação)
async function verificarLogs() {
  console.log('\n4️⃣ INSTRUÇÕES PARA VERIFICAR LOGS');
  console.log('-'.repeat(40));
  
  console.log('📝 Execute os seguintes comandos no servidor:');
  console.log('');
  console.log('# Verificar se o container está rodando:');
  console.log('docker-compose -f docker-compose.prod.yml ps');
  console.log('');
  console.log('# Ver logs em tempo real:');
  console.log('docker-compose -f docker-compose.prod.yml logs -f autosheets');
  console.log('');
  console.log('# Ver logs específicos de webhook:');
  console.log('docker-compose -f docker-compose.prod.yml logs autosheets | grep -i webhook');
  console.log('');
  console.log('# Ver logs específicos de reply:');
  console.log('docker-compose -f docker-compose.prod.yml logs autosheets | grep -i reply');
  console.log('');
  console.log('# Verificar cache:');
  console.log('docker-compose -f docker-compose.prod.yml exec autosheets cat .bet-cache.json');
}

// 5. Gerar script de correção
function gerarScriptCorrecao(problemas) {
  console.log('\n5️⃣ SCRIPT DE CORREÇÃO');
  console.log('-'.repeat(40));
  
  if (problemas.webhook) {
    console.log('🔧 Para corrigir o webhook:');
    console.log('npm run webhook:delete && npm run webhook:set');
    console.log('');
  }
  
  if (problemas.conectividade) {
    console.log('🔧 Para verificar conectividade:');
    console.log('# Verificar se nginx está rodando:');
    console.log('sudo systemctl status nginx');
    console.log('');
    console.log('# Verificar se a aplicação está rodando:');
    console.log('docker-compose -f docker-compose.prod.yml ps');
    console.log('');
    console.log('# Reiniciar se necessário:');
    console.log('docker-compose -f docker-compose.prod.yml restart');
    console.log('');
  }
  
  if (problemas.cache) {
    console.log('🔧 Para verificar o cache:');
    console.log('# Verificar se o monitor está rodando:');
    console.log('docker-compose -f docker-compose.prod.yml logs gramjs-monitor');
    console.log('');
    console.log('# Verificar cache:');
    console.log('docker-compose -f docker-compose.prod.yml exec autosheets ls -la .bet-cache.json');
    console.log('docker-compose -f docker-compose.prod.yml exec autosheets cat .bet-cache.json');
    console.log('');
  }
  
  console.log('🔧 Comandos gerais de diagnóstico:');
  console.log('# Verificar variáveis de ambiente:');
  console.log('docker-compose -f docker-compose.prod.yml exec autosheets env | grep TELEGRAM');
  console.log('');
  console.log('# Testar webhook manualmente:');
  console.log('curl -X POST "https://autosheets.loudigital.shop/api/telegram/webhook" \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log(`  -d '${JSON.stringify({update_id:123,message:{text:"teste"}})}'`);
}

// Executar diagnóstico completo
async function executarDiagnostico() {
  const problemas = {
    webhook: false,
    conectividade: false,
    cache: false
  };
  
  // Verificar webhook
  const webhookOk = await verificarWebhook();
  if (!webhookOk) problemas.webhook = true;
  
  // Testar conectividade
  const conectividadeOk = await testarConectividade();
  if (!conectividadeOk) problemas.conectividade = true;
  
  // Testar reply
  const replyOk = await testarReply();
  if (!replyOk) problemas.cache = true;
  
  // Mostrar instruções para logs
  verificarLogs();
  
  // Gerar script de correção
  gerarScriptCorrecao(problemas);
  
  console.log('\n📊 RESUMO DO DIAGNÓSTICO');
  console.log('='.repeat(60));
  console.log('Webhook configurado:', webhookOk ? '✅' : '❌');
  console.log('Conectividade:', conectividadeOk ? '✅' : '❌');
  console.log('Processamento de reply:', replyOk ? '✅' : '❌');
  
  if (webhookOk && conectividadeOk && replyOk) {
    console.log('\n🎉 TUDO FUNCIONANDO! O problema pode estar no monitor GramJS.');
    console.log('   Verifique se o monitor está detectando apostas e salvando no cache.');
  } else {
    console.log('\n🔍 PROBLEMAS IDENTIFICADOS:');
    if (problemas.webhook) console.log('   - Webhook não configurado corretamente');
    if (problemas.conectividade) console.log('   - Problema de conectividade com o servidor');
    if (problemas.cache) console.log('   - Problema no processamento de replies (cache vazio)');
  }
  
  console.log('\n📝 Execute os comandos de correção acima para resolver os problemas.');
}

// Executar
executarDiagnostico().catch(console.error);