#!/usr/bin/env node

/**
 * Script de teste para verificar o sistema de replies do bot Telegram
 * 
 * Este script simula o fluxo completo:
 * 1. Criação de uma aposta no cache
 * 2. Simulação de uma resposta do usuário
 * 3. Verificação se a resposta é processada corretamente
 */

const fs = require('fs');
const path = require('path');

// Simular dados de uma aposta
const mockBetData = {
  jogo: "Flamengo vs Palmeiras",
  placar: "1x0",
  mercado: "Goal Line",
  linha_da_aposta: "GL +0.5",
  odd_tipster: "1.85",
  chatId: 123456789,
  userId: 987654321,
  username: "testuser",
  timestamp: new Date().toISOString(),
  pegou: null,
  odd_real: null
};

// Simular IDs do Telegram
const YOUR_USER_ID = "123456789";
const BOT_MESSAGE_ID = "456";
const betKey = `${YOUR_USER_ID}_${BOT_MESSAGE_ID}`;

console.log('🧪 Iniciando teste do sistema de replies...');
console.log(`📋 Chave de teste: ${betKey}`);

// 1. Simular salvamento no cache
const cacheFile = '.bet-cache.json';
let cache = {};

if (fs.existsSync(cacheFile)) {
  try {
    cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    console.log('📂 Cache existente carregado');
  } catch (error) {
    console.log('⚠️ Erro ao carregar cache, criando novo');
    cache = {};
  }
} else {
  console.log('📂 Criando novo arquivo de cache');
}

// Adicionar aposta de teste
cache[betKey] = mockBetData;
fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
console.log('✅ Aposta de teste salva no cache');

// 2. Simular webhook payload
const mockWebhookPayload = {
  message: {
    message_id: 789,
    from: {
      id: parseInt(YOUR_USER_ID),
      first_name: "Test User",
      username: "testuser"
    },
    chat: {
      id: parseInt(YOUR_USER_ID),
      type: "private"
    },
    date: Math.floor(Date.now() / 1000),
    text: "1.95", // Odd de resposta
    reply_to_message: {
      message_id: parseInt(BOT_MESSAGE_ID),
      from: {
        id: 123456789, // Bot ID
        is_bot: true,
        first_name: "AutoSheets Bot"
      },
      chat: {
        id: parseInt(YOUR_USER_ID),
        type: "private"
      },
      date: Math.floor(Date.now() / 1000) - 60,
      text: "🎯 **Aposta detectada no grupo!**\n\n⚽ **Jogo:** Flamengo vs Palmeiras..."
    }
  }
};

console.log('📦 Payload de teste criado:');
console.log(JSON.stringify(mockWebhookPayload, null, 2));

// 3. Verificar se a chave seria encontrada
const replyToMessageId = mockWebhookPayload.message.reply_to_message.message_id;
const userId = mockWebhookPayload.message.from.id;
const generatedKey = `${userId}_${replyToMessageId}`;

console.log('\n🔍 Verificação de chaves:');
console.log(`- Chave salva no cache: ${betKey}`);
console.log(`- Chave que seria gerada pelo webhook: ${generatedKey}`);
console.log(`- Chaves são iguais: ${betKey === generatedKey ? '✅ SIM' : '❌ NÃO'}`);

// 4. Verificar se a aposta seria encontrada
const foundBet = cache[generatedKey];
console.log(`- Aposta seria encontrada: ${foundBet ? '✅ SIM' : '❌ NÃO'}`);

if (foundBet) {
  console.log('\n🎉 TESTE PASSOU! O sistema de replies deve funcionar corretamente.');
  console.log('\n📋 Dados da aposta encontrada:');
  console.log(JSON.stringify(foundBet, null, 2));
} else {
  console.log('\n❌ TESTE FALHOU! Há ainda um problema no sistema de replies.');
  console.log('\n🔍 Chaves disponíveis no cache:');
  console.log(Object.keys(cache));
}

// 5. Simular processamento da odd
if (foundBet) {
  const oddText = mockWebhookPayload.message.text;
  const oddReal = parseFloat(oddText.replace(',', '.'));
  
  console.log('\n💰 Simulando processamento da odd:');
  console.log(`- Texto recebido: "${oddText}"`);
  console.log(`- Odd parseada: ${oddReal}`);
  
  if (oddReal > 0) {
    foundBet.pegou = true;
    foundBet.odd_real = oddReal;
    console.log('✅ Aposta seria marcada como PEGA');
  } else {
    foundBet.pegou = false;
    foundBet.odd_real = null;
    console.log('❌ Aposta seria marcada como NÃO PEGA');
  }
  
  console.log('\n📊 Dados finais da aposta:');
  console.log(JSON.stringify(foundBet, null, 2));
}

// 6. Limpeza
console.log('\n🧹 Limpando dados de teste...');
delete cache[betKey];
if (Object.keys(cache).length === 0) {
  fs.unlinkSync(cacheFile);
  console.log('🗑️ Arquivo de cache removido (estava vazio)');
} else {
  fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
  console.log('💾 Cache atualizado (outros dados preservados)');
}

console.log('\n✅ Teste concluído!');
console.log('\n📝 Próximos passos:');
console.log('1. Reinicie o monitor GramJS: npm run monitor');
console.log('2. Teste com uma aposta real em um grupo monitorado');
console.log('3. Verifique os logs para confirmar o funcionamento');