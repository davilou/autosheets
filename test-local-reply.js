/**
 * Script para testar o processamento de replies localmente
 * Execute este script enquanto o servidor Next.js estiver rodando
 */

const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });

// Primeiro, vamos simular uma aposta no cache
const fs = require('fs');
const cacheFile = '.bet-cache.json';

// Criar uma aposta de teste no cache
const testBetKey = '670237902_123';
const testBetData = {
  jogo: "Teste Local vs Desenvolvimento",
  placar: "1-0",
  mercado: "Over/Under",
  linha_da_aposta: "Over 2.5",
  odd_tipster: "1.85",
  grupo: "Teste Local",
  timestamp: new Date().toISOString(),
  pegou: null,
  odd_real: null
};

// Salvar no cache
let cache = {};
if (fs.existsSync(cacheFile)) {
  try {
    cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  } catch (e) {
    console.log('Cache file corrupted, creating new one');
  }
}

cache[testBetKey] = testBetData;
fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));

console.log('✅ Aposta de teste criada no cache:');
console.log('   Chave:', testBetKey);
console.log('   Dados:', testBetData);
console.log('');

// Simular um reply do Telegram
const mockReplyUpdate = {
  update_id: 123456789,
  message: {
    message_id: 999,
    from: {
      id: 670237902,
      is_bot: false,
      first_name: "Teste Local",
      username: "teste_local"
    },
    chat: {
      id: 670237902,
      first_name: "Teste Local",
      username: "teste_local",
      type: "private"
    },
    date: Math.floor(Date.now() / 1000),
    text: "1.95", // Odd que o usuário conseguiu
    reply_to_message: {
      message_id: 123, // Deve corresponder ao ID na chave do cache
      from: {
        id: 7487941746,
        is_bot: true,
        first_name: "AutoSheets",
        username: "AutoSheetsBot"
      },
      chat: {
        id: 670237902,
        first_name: "Teste Local",
        username: "teste_local",
        type: "private"
      },
      date: Math.floor(Date.now() / 1000) - 60,
      text: "🎯 Aposta detectada no grupo!\n\n⚽ Jogo: Teste Local vs Desenvolvimento\n⚽ Placar: 1-0\n📊 Mercado: Over/Under\n📈 Linha: Over 2.5\n💰 Odd Tipster: 1.85\n\n💎 Responda esta mensagem com a odd real que você conseguiu\n(Digite 0 se não conseguiu pegar a aposta)"
    }
  }
};

const postData = JSON.stringify(mockReplyUpdate);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/telegram/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🧪 Enviando teste de reply para o webhook local...');
console.log('📤 URL:', `http://${options.hostname}:${options.port}${options.path}`);
console.log('📦 Payload:', JSON.stringify(mockReplyUpdate, null, 2));
console.log('');

const req = http.request(options, (res) => {
  console.log(`📊 Status da resposta: ${res.statusCode}`);
  console.log(`📋 Headers:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('📥 Resposta do webhook:', data);
    
    // Verificar se a aposta foi processada (removida do cache)
    setTimeout(() => {
      console.log('');
      console.log('🔍 Verificando se a aposta foi processada...');
      
      if (fs.existsSync(cacheFile)) {
        const updatedCache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        
        if (updatedCache[testBetKey]) {
          console.log('❌ Aposta ainda está no cache - não foi processada');
          console.log('   Dados atuais:', updatedCache[testBetKey]);
        } else {
          console.log('✅ Aposta foi removida do cache - processada com sucesso!');
        }
      } else {
        console.log('❌ Cache file não existe mais');
      }
      
      console.log('');
      console.log('📝 Verifique os logs do servidor Next.js no terminal para mais detalhes.');
    }, 1000);
  });
});

req.on('error', (e) => {
  console.error(`❌ Erro na requisição: ${e.message}`);
});

req.write(postData);
req.end();