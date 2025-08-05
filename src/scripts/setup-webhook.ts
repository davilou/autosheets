import dotenv from 'dotenv';
import path from 'path';

// Carregar variáveis de ambiente
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://your-domain.com/api/telegram/webhook';

async function setupWebhook() {
  try {
    console.log('🔧 Configurando webhook do bot Telegram...');
    console.log('📍 URL do webhook:', WEBHOOK_URL);
    
    // Primeiro, vamos verificar o status atual do webhook
    const getWebhookResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`
    );
    const webhookInfo = await getWebhookResponse.json();
    
    console.log('📊 Status atual do webhook:');
    console.log(JSON.stringify(webhookInfo, null, 2));
    
    // Configurar o webhook
    const setWebhookResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: WEBHOOK_URL,
          allowed_updates: ['message'], // Apenas mensagens
          drop_pending_updates: true, // Limpar updates pendentes
        })
      }
    );
    
    const setWebhookResult = await setWebhookResponse.json();
    
    if (setWebhookResult.ok) {
      console.log('✅ Webhook configurado com sucesso!');
      console.log('📝 Resposta:', setWebhookResult.description);
    } else {
      console.error('❌ Erro ao configurar webhook:', setWebhookResult);
    }
    
    // Verificar novamente o status
    const finalWebhookResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`
    );
    const finalWebhookInfo = await finalWebhookResponse.json();
    
    console.log('📊 Status final do webhook:');
    console.log(JSON.stringify(finalWebhookInfo, null, 2));
    
  } catch (error) {
    console.error('❌ Erro ao configurar webhook:', error);
  }
}

async function deleteWebhook() {
  try {
    console.log('🗑️ Removendo webhook do bot Telegram...');
    
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drop_pending_updates: true
        })
      }
    );
    
    const result = await response.json();
    
    if (result.ok) {
      console.log('✅ Webhook removido com sucesso!');
    } else {
      console.error('❌ Erro ao remover webhook:', result);
    }
    
  } catch (error) {
    console.error('❌ Erro ao remover webhook:', error);
  }
}

async function main() {
  const command = process.argv[2];
  
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN não configurado!');
    process.exit(1);
  }
  
  switch (command) {
    case 'set':
      await setupWebhook();
      break;
    case 'delete':
      await deleteWebhook();
      break;
    case 'info':
      const response = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`
      );
      const info = await response.json();
      console.log('📊 Informações do webhook:');
      console.log(JSON.stringify(info, null, 2));
      break;
    default:
      console.log('📖 Uso:');
      console.log('  npm run webhook:set    - Configurar webhook');
      console.log('  npm run webhook:delete - Remover webhook');
      console.log('  npm run webhook:info   - Ver status do webhook');
      break;
  }
}

main();