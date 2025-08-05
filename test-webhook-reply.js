/**
 * Script de teste para verificar se o webhook está capturando replies corretamente
 * Execute este script após configurar o webhook
 */

const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });

// Simular um update de reply do Telegram
const mockReplyUpdate = {
  update_id: 123456789,
  message: {
    message_id: 999,
    from: {
      id: 670237902,
      is_bot: false,
      first_name: "Test User",
      username: "testuser"
    },
    chat: {
      id: 670237902,
      first_name: "Test User",
      username: "testuser",
      type: "private"
    },
    date: Math.floor(Date.now() / 1000),
    text: "1.85",
    reply_to_message: {
      message_id: 386,
      from: {
        id: 7487941746,
        is_bot: true,
        first_name: "ApostasMonitorBot",
        username: "ApostasMonitorBot"
      },
      chat: {
        id: 670237902,
        first_name: "Test User",
        username: "testuser",
        type: "private"
      },
      date: Math.floor(Date.now() / 1000) - 60,
      text: "🎯 Aposta detectada no grupo!\n\n⚽ Jogo: GSC Liebenfels vs SGA Sirnitz\n⚽ Placar: 0-1\n📊 Mercado: Over/Under\n📈 Linha: Under 2.25\n💰 Odd Tipster: 1.72\n\n💎 Responda esta mensagem com a odd real que você conseguiu\n(Digite 0 se não conseguiu pegar a aposta)"
    }
  }
};

async function testWebhook() {
  console.log('🧪 Testando webhook com reply simulado...');
  console.log('📊 Update simulado:', JSON.stringify(mockReplyUpdate, null, 2));
  
  const webhookUrl = process.env.WEBHOOK_URL || 'https://autosheets.loudigital.shop/api/telegram/webhook';
  const url = new URL(webhookUrl);
  
  const postData = JSON.stringify(mockReplyUpdate);
  
  const options = {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'User-Agent': 'TelegramBot/1.0'
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`📡 Status: ${res.statusCode}`);
        console.log(`📝 Headers:`, res.headers);
        console.log(`📄 Response:`, data);
        
        if (res.statusCode === 200) {
          console.log('✅ Webhook respondeu corretamente!');
          resolve(data);
        } else {
          console.log(`❌ Webhook retornou erro: ${res.statusCode}`);
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', (err) => {
      console.error('❌ Erro na requisição:', err.message);
      reject(err);
    });
    
    req.write(postData);
    req.end();
  });
}

async function main() {
  try {
    console.log('🚀 Iniciando teste do webhook...');
    console.log(`🔗 URL do webhook: ${process.env.WEBHOOK_URL}`);
    console.log(`👤 User ID: ${process.env.YOUR_USER_ID}`);
    console.log('');
    
    await testWebhook();
    
    console.log('');
    console.log('✅ Teste concluído!');
    console.log('📋 Próximos passos:');
    console.log('1. Verifique os logs da aplicação para ver se o reply foi processado');
    console.log('2. Confirme se a chave betKey foi encontrada: 670237902_386');
    console.log('3. Teste com um reply real no Telegram');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    console.log('');
    console.log('🔧 Possíveis soluções:');
    console.log('1. Verifique se a aplicação está rodando');
    console.log('2. Confirme se o webhook está configurado corretamente');
    console.log('3. Verifique se a URL do webhook está acessível');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { testWebhook, mockReplyUpdate };