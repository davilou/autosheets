import dotenv from 'dotenv';
import path from 'path';
import GramJSMonitor from '@/lib/telegram/gramjs-monitor';
// NOVO: Import da função do webhook
import { setGramJSMonitor } from '@/lib/telegram/monitor-connection';

// Carregar variáveis de ambiente do .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const config = {
  apiId: parseInt(process.env.TELEGRAM_API_ID!),
  apiHash: process.env.TELEGRAM_API_HASH!,
  session: process.env.TELEGRAM_SESSION_STRING || '',
  allowedChatIds: process.env.MONITORED_CHAT_IDS?.split(',') || [],
  yourUserId: process.env.YOUR_USER_ID!,
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
};

// Verificar se as variáveis foram carregadas
console.log('🔍 Verificando configurações:');
console.log('API ID:', config.apiId);
console.log('API Hash:', config.apiHash ? 'Configurado' : 'VAZIO');
console.log('Bot Token:', config.botToken ? 'Configurado' : 'VAZIO');
console.log('User ID:', config.yourUserId);
console.log('Chats monitorados:', config.allowedChatIds);

if (!config.apiId || !config.apiHash) {
  console.error('❌ TELEGRAM_API_ID ou TELEGRAM_API_HASH não configurados!');
  process.exit(1);
}

const monitor = new GramJSMonitor(config);

async function main() {
  try {
    console.log('🚀 Iniciando GramJS Monitor...');
    await monitor.start();
    
    // NOVO: Conectar o monitor ao webhook
    setGramJSMonitor(monitor);
    
    // Salvar session string para próximas execuções
    const sessionString = await monitor.getSessionString();
    console.log('💾 Session String (salve no .env.local):');
    console.log(`TELEGRAM_SESSION_STRING=${sessionString}`);
    
    console.log('🎯 Monitor ativo! Aguardando mensagens dos grupos...');
    console.log('🔗 Webhook conectado ao monitor!');
    
    // Manter o processo rodando
    process.on('SIGINT', async () => {
      console.log('🛑 Parando monitor...');
      await monitor.stop();
      process.exit(0);
    });
    
    // Manter vivo
    setInterval(() => {
      console.log('💓 Monitor ativo...');
    }, 60000); // Log a cada minuto
    
  } catch (error) {
    console.error('❌ Erro ao iniciar monitor:', error);
    process.exit(1);
  }
}

main();