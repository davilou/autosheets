import { NextRequest, NextResponse } from 'next/server';
import GoogleSheetsService from '@/lib/sheets/service';
import { GeminiParser } from '@/lib/gemini/parser';
import { BetData } from '@/lib/telegram/parser';
// NOVO: Import do GramJS monitor
import GramJSMonitor from '@/lib/telegram/gramjs-monitor';
import { SharedBetCache } from '@/lib/shared/bet-cache';

const sheetsConfig = {
  spreadsheetId: process.env.GOOGLE_SHEETS_ID!,
  range: 'Apostas!A:J',
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL!,
    private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  },
};

const sheetsService = new GoogleSheetsService(sheetsConfig);

// NOVO: Instância global do GramJS monitor
let gramjsMonitor: GramJSMonitor | null = null;

// NOVO: Função para conectar ao monitor existente
export function setGramJSMonitor(monitor: GramJSMonitor) {
  gramjsMonitor = monitor;
  console.log('🔗 Monitor GramJS conectado ao webhook');
}

export async function POST(request: Request) {
  console.log('🔄 Webhook recebido');
  
  try {
    const update = await request.json();
    console.log('📦 Update recebido:', JSON.stringify(update, null, 2));
    
    // NOVO: Log detalhado
    console.log('🔍 Tipo de update:', {
      hasMessage: !!update.message,
      hasText: !!update.message?.text,
      hasReplyTo: !!update.message?.reply_to_message,
      chatId: update.message?.chat?.id,
      userId: update.message?.from?.id,
      messageText: update.message?.text
    });
    
    const message = update.message;
    
    // Processar apenas respostas às notificações do bot
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const userId = update.message.from.id;
      const messageText = update.message.text;
      
      console.log(`📨 Mensagem de ${userId}: "${messageText}"`);
      
      // Verificar se é uma resposta a uma notificação do bot
      // ...
      // Na função POST, substitua a verificação do monitor:
      if (message.reply_to_message) {
        const repliedMessageId = message.reply_to_message.message_id;
        const betKey = `${chatId}_${repliedMessageId}`;
        
        console.log(`🔍 Procurando aposta com chave: ${betKey}`);
        
        let betData = null;
        
        // Verificar primeiro no GramJS monitor (se disponível)
        if (gramjsMonitor) {
          betData = gramjsMonitor.getPendingBet(betKey);
          console.log(`📋 Aposta encontrada no GramJS monitor: ${!!betData}`);
        }
        
        // Se não encontrou no monitor, verificar no cache compartilhado
        if (!betData) {
          betData = SharedBetCache.getBet(betKey);
          console.log(`📋 Aposta encontrada no cache compartilhado: ${!!betData}`);
        }
        
        if (betData) {
          console.log('💰 Processando resposta à notificação...');
          await handleOddReply(update, betKey, betData);
          
          // Remover de ambos os caches
          if (gramjsMonitor) {
            gramjsMonitor.removePendingBet(betKey);
          }
          SharedBetCache.removeBet(betKey);
          
          return NextResponse.json({ ok: true, processed: true });
        }
      }
      
      console.log('ℹ️ Mensagem não relacionada a apostas pendentes');
    }
    
    return NextResponse.json({ ok: true, processed: false });
  } catch (error) {
    console.error('❌ Erro no webhook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Função para processar resposta da odd (corrigir tipagem)
async function handleOddReply(update: any, betKey: string, betData: BetData) {
  // Adicionar verificações de segurança
  if (!update?.message?.chat?.id || !update?.message?.text) {
    console.error('❌ Update inválido recebido:', update);
    return;
  }
  
  const chatId = update.message.chat.id;
  const messageText = update.message.text.trim();
  
  console.log(`📊 Processando resposta da ODD: "${messageText}" para chave: ${betKey}`);
  
  const oddReal = parseFloat(messageText.replace(',', '.'));
  console.log(`📊 Odd recebida: ${messageText} -> ${oddReal}`);
  
  if (oddReal === 0) {
    // Aposta não foi pega
    betData.pegou = false;
    betData.odd_real = null;
    
    console.log('💾 Salvando aposta como NÃO PEGA no Google Sheets:', betData);
    const success = await sheetsService.addBetData(betData);
    
    if (success) {
      await sendTelegramMessage(
        chatId,
        `❌ **Aposta não realizada**\n\n` +
        `⚽ **Jogo:** ${betData.jogo}\n` +
        `⚽ **Placar:** ${betData.placar || '0-0'}\n` +
        `📊 **Mercado:** ${betData.mercado}\n` +
        `📈 **Linha:** ${betData.linha_da_aposta}\n` +
        `💰 **Odd Tipster:** ${betData.odd_tipster}\n\n` +
        `✅ Registrado que a aposta não foi pega.`
      );
      console.log('✅ Aposta marcada como não realizada e salva com sucesso');
    } else {
      console.error('❌ Erro ao salvar aposta não realizada');
      await sendTelegramMessage(
        chatId,
        `❌ **Erro ao salvar**\n\nHouve erro ao salvar no Google Sheets. Verifique os logs.`
      );
    }
  } else if (!isNaN(oddReal) && oddReal > 0) {
    // Aposta foi pega com odd válida
    betData.pegou = true;
    betData.odd_real = oddReal;
    
    console.log('💾 Salvando aposta PEGA no Google Sheets:', betData);
    
    const success = await sheetsService.addBetData(betData);
    
    if (success) {
      await sendTelegramMessage(
        chatId,
        `✅ **Aposta registrada com sucesso!**\n\n` +
        `⚽ **Jogo:** ${betData.jogo}\n` +
        `⚽ **Placar:** ${betData.placar || '0-0'}\n` +
        `📊 **Mercado:** ${betData.mercado}\n` +
        `📈 **Linha:** ${betData.linha_da_aposta}\n` +
        `💰 **Odd Tipster:** ${betData.odd_tipster}\n` +
        `💎 **Odd Real:** ${betData.odd_real}\n` +
        `📊 **Status:** ${betData.resultado_aposta}`
      );
      
      console.log('✅ Aposta salva com sucesso no Google Sheets');
    } else {
      console.error('❌ Erro ao salvar aposta no Google Sheets');
      await sendTelegramMessage(
        chatId,
        `❌ **Erro ao salvar**\n\nHouve erro ao salvar no Google Sheets. Verifique os logs.`
      );
    }
  } else {
    // Odd inválida
    console.log(`❌ Odd inválida recebida: ${messageText}`);
    await sendTelegramMessage(
      chatId,
      `❌ **Odd inválida**\n\nPor favor, responda com um número válido ou 0 para \"não peguei\".\n\nExemplos: 1.85, 2.50, 0`
    );
    return; // Não remove do cache
  }
}

async function sendTelegramMessage(chatId: number, text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  
  try {
    console.log(`Enviando mensagem para chat ${chatId}:`, text);
    
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
      })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('Erro na API do Telegram:', result);
    } else {
      console.log('Mensagem enviada com sucesso');
    }
    
    return result;
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
  }
}

async function getTelegramFileUrl(fileId: string): Promise<string> {
  const response = await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`
  );
  const data = await response.json();
  return `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${data.result.file_path}`;
}