import { NextRequest, NextResponse } from 'next/server';
import GoogleSheetsService from '@/lib/sheets/service';
import { GeminiParser } from '@/lib/gemini/parser';
import { BetData } from '@/lib/telegram/parser';
// CORREÇÃO: Import do GramJS monitor com auto-inicialização
import { getGramJSMonitor, setGramJSMonitor } from '@/lib/telegram/monitor-connection';
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

// CORREÇÃO: Função para auto-inicializar monitor se necessário
async function ensureMonitorConnected() {
  let monitor = getGramJSMonitor();
  
  if (!monitor) {
    console.log('🔧 Monitor não conectado, inicializando automaticamente...');
    
    try {
      const config = {
        apiId: parseInt(process.env.TELEGRAM_API_ID!),
        apiHash: process.env.TELEGRAM_API_HASH!,
        session: process.env.TELEGRAM_SESSION_STRING || '',
        allowedChatIds: process.env.MONITORED_CHAT_IDS?.split(',') || [],
        yourUserId: process.env.YOUR_USER_ID!,
        botToken: process.env.TELEGRAM_BOT_TOKEN!,
      };
      
      monitor = new GramJSMonitor(config);
      await monitor.start();
      setGramJSMonitor(monitor);
      
      console.log('✅ Monitor GramJS inicializado e conectado ao webhook automaticamente');
    } catch (error) {
      console.error('❌ Erro ao inicializar monitor automaticamente:', error);
    }
  }
  
  return monitor;
}

export async function POST(request: Request) {
  console.log('🔄 WEBHOOK RECEBIDO - TIMESTAMP:', new Date().toISOString());
  
  // CORREÇÃO: Garantir que o monitor esteja conectado
  const gramjsMonitor = await ensureMonitorConnected();
  console.log(`🔗 Status do monitor: ${gramjsMonitor ? 'CONECTADO' : 'DESCONECTADO'}`);
  
  if (gramjsMonitor) {
    console.log('✅ Monitor disponível para processar replies');
  } else {
    console.log('❌ Monitor não disponível - replies não serão processados');
  }
  
  try {
    let update;
    try {
      // Log do corpo da requisição antes do parsing
      const requestText = await request.text();
      console.log('📄 Corpo da requisição (primeiros 100 chars):', requestText.substring(0, 100));
      console.log('📏 Tamanho do corpo:', requestText.length);
      
      // Parse do JSON
      update = JSON.parse(requestText);
    } catch (jsonError) {
      console.error('❌ Erro ao fazer parse do JSON da requisição:', jsonError instanceof Error ? jsonError.message : jsonError);
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    console.log('📦 Update recebido - message_id:', update.message?.message_id, 'reply_to:', update.message?.reply_to_message?.message_id);
    
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
      
      // NOVO: Verificar se é uma resposta
        if (message.reply_to_message) {
          console.log('🎯 REPLY DETECTADO! Iniciando processamento...');
          const repliedMessageId = message.reply_to_message.message_id;
          // CORREÇÃO CRÍTICA: Usar YOUR_USER_ID consistentemente como no monitor
          const yourUserId = process.env.YOUR_USER_ID!;
          const betKey = `${yourUserId}_${repliedMessageId}`;
          console.log('🎯 REPLY DEBUG - Dados extraídos:', {
            repliedMessageId,
            yourUserId,
            betKey,
            replyFromBot: message.reply_to_message.from?.is_bot,
            replyBotUsername: message.reply_to_message.from?.username
          });
          
          console.log('🔧 CORREÇÃO APLICADA: Usando YOUR_USER_ID para consistência');
          
          console.log('🔍 Debug da chave (CORRIGIDA):');
          console.log('- chatId:', chatId);
          console.log('- userId (remetente):', userId);
          console.log('- yourUserId (usado na chave):', yourUserId);
          console.log('- repliedMessageId:', repliedMessageId);
          console.log('- betKey gerada:', betKey);
          console.log('- Consistência com monitor: ✅');
          
          // ADICIONAR: Log das chaves disponíveis
          try {
            console.log('🔍 Verificando se arquivo .bet-cache.json existe...');
            const fileExists = require('fs').existsSync('.bet-cache.json');
            console.log('📁 Arquivo .bet-cache.json existe:', fileExists);
            
            if (fileExists) {
              console.log('🔍 Lendo conteúdo do arquivo .bet-cache.json...');
              const fileContent = require('fs').readFileSync('.bet-cache.json', 'utf8');
              console.log('📄 Conteúdo bruto do arquivo:', fileContent.substring(0, 100) + '...');
              
              console.log('🔍 Fazendo parse do JSON do cache...');
              const cacheData = JSON.parse(fileContent);
              console.log('✅ Parse do cache bem-sucedido');
              console.log('- Chaves no cache compartilhado:', Object.keys(cacheData));
            } else {
              console.log('- Arquivo não existe, usando objeto vazio');
              console.log('- Chaves no cache compartilhado: []');
            }
          } catch (error) {
            console.log('❌ Erro ao ler cache compartilhado:', error instanceof Error ? error.message : error);
            console.log('❌ Stack trace:', error instanceof Error ? error.stack : 'N/A');
            console.log('- Chaves no cache compartilhado: []');
          }
          
          if (gramjsMonitor) {
            console.log('- Chaves disponíveis no monitor:', gramjsMonitor.getPendingBetsKeys());
          }
          
          console.log(`🔍 Procurando aposta com chave: ${betKey}`);
          console.log(`🔍 Monitor disponível: ${!!gramjsMonitor}`);
        
        let betData = null;
        
        // Verificar primeiro no GramJS monitor (se disponível)
        if (gramjsMonitor) {
          betData = gramjsMonitor.getPendingBet(betKey);
          console.log(`📋 Aposta encontrada no GramJS monitor: ${!!betData}`);
          if (betData) {
            console.log(`📋 Dados da aposta no monitor:`, betData);
          }
        } else {
          console.log('⚠️ GramJS monitor não está disponível!');
        }
        
        // Se não encontrou no monitor, verificar no cache compartilhado
        if (!betData) {
          console.log(`🔍 Verificando cache compartilhado para: ${betKey}`);
          betData = SharedBetCache.getBet(betKey);
          console.log(`📋 Aposta encontrada no cache compartilhado: ${!!betData}`);
          if (betData) {
            console.log(`📋 Dados da aposta no cache:`, betData);
          }
        }
        
        // NOVO: Log do estado dos caches
        console.log('📊 Estado dos caches:');
        console.log('- Monitor pendingBets size:', gramjsMonitor ? gramjsMonitor.getPendingBetsCount() : 'N/A');
        console.log('- Cache file exists:', require('fs').existsSync('.bet-cache.json'));
        
        if (betData) {
          console.log('💰 Processando resposta à notificação...');
          await handleOddReply(update, betKey, betData);
          
          // Remover de ambos os caches
          if (gramjsMonitor) {
            gramjsMonitor.removePendingBet(betKey);
          }
          SharedBetCache.removeBet(betKey);
          
          return NextResponse.json({ ok: true, processed: true });
        } else {
          console.log('❌ Nenhuma aposta pendente encontrada para esta resposta');
          console.log('❌ Chave procurada:', betKey);
          console.log('❌ Isso pode indicar que:');
          console.log('   1. A aposta expirou ou foi removida');
          console.log('   2. O monitor não está funcionando');
          console.log('   3. Há um problema na geração da chave');
        }
      } else {
        console.log('ℹ️ Mensagem não é uma resposta (não tem reply_to_message)');
      }
    } else {
      console.log('ℹ️ Update não contém mensagem de texto');
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