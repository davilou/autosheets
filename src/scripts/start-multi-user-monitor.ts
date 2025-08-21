#!/usr/bin/env node

// Definir contexto de monitor ANTES de carregar outras dependências
process.env.MONITOR_CONTEXT = 'true';

import dotenv from 'dotenv';
import path from 'path';
import MonitorManager from '../lib/telegram/monitor-manager';
import { PrismaClient } from '@prisma/client';
import { SharedBetCache } from '@/lib/shared/bet-cache';
import GoogleSheetsService from '@/lib/sheets/service';
import SpreadsheetManager from '@/lib/spreadsheets/manager';
import { normalizeScore } from '@/lib/utils';
import { formatOddBrazilian } from '@/lib/utils';

// Carregar variáveis de ambiente
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
dotenv.config({ path: path.join(process.cwd(), envFile) });
console.log(`📋 Carregando variáveis de ambiente de: ${envFile}`);
console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`🤖 Bot Token configurado: ${process.env.TELEGRAM_BOT_TOKEN ? 'Sim' : 'Não'}`);
console.log(`📊 Redis Host: ${process.env.REDIS_HOST || 'Não configurado'}`);
console.log(`🗄️ Database URL configurada: ${process.env.DATABASE_URL ? 'Sim' : 'Não'}`);
console.log('---')

const prisma = new PrismaClient();

// Função para iniciar monitoramento para usuários com credenciais conectadas
async function startMonitoringForConnectedUsers(monitorManager: MonitorManager) {
  try {
    console.log('🔍 Verificando usuários com credenciais conectadas...');
    
    // Buscar credenciais conectadas com grupos monitorados, mas sem sessões ativas
    const credentialsWithoutSessions = await prisma.telegramCredential.findMany({
      where: {
        status: 'CONNECTED',
        isActive: true,
        monitoredGroups: {
          some: {
            isActive: true
          }
        },
        // Não tem sessões de monitoramento ativas
         monitorSessions: {
           none: {
             isActive: true
           }
         }
      },
      include: {
        user: true,
        monitoredGroups: {
          where: { isActive: true }
        }
      }
    });
    
    console.log(`📋 Encontradas ${credentialsWithoutSessions.length} credenciais sem sessões ativas`);
    
    // Iniciar monitoramento para cada credencial
    for (const credential of credentialsWithoutSessions) {
      try {
        console.log(`🚀 Iniciando monitoramento automático para usuário ${credential.user.email} (${credential.monitoredGroups.length} grupos)`);
        
        const result = await monitorManager.startUserMonitoring(
          credential.userId,
          credential.id
        );
        
        if (result.success) {
          console.log(`✅ Monitoramento iniciado para ${credential.user.email}`);
        } else {
          console.log(`⚠️ Falha ao iniciar monitoramento para ${credential.user.email}: ${result.message}`);
        }
      } catch (error) {
        console.error(`❌ Erro ao iniciar monitoramento para ${credential.user.email}:`, error);
      }
    }
  } catch (error) {
    console.error('❌ Erro ao verificar usuários com credenciais conectadas:', error);
  }
}

async function startMultiUserMonitor() {
  console.log('🚀 Iniciando Sistema de Monitoramento Multi-Usuário...');
  
  try {
    // Inicializar o gerenciador de monitoramento
    const monitorManager = MonitorManager.getInstance();
    await monitorManager.initialize();
    
    console.log('✅ Sistema de monitoramento inicializado com sucesso!');
    
    // IMPORTANTE: Configurar handlers de eventos ANTES de iniciar o monitoramento
    monitorManager.on('sessionStarted', (data) => {
      console.log(`📱 Sessão iniciada: ${data.userId} (${data.credentialId})`);
    });
    
    monitorManager.on('sessionStopped', (data) => {
      console.log(`🛑 Sessão parada: ${data.userId} (${data.credentialId})`);
    });
    
    monitorManager.on('sessionError', (data) => {
      console.error(`❌ Erro na sessão: ${data.userId}`, data.error);
    });
    
    monitorManager.on('sessionUnhealthy', (data) => {
      console.warn(`⚠️ Sessão não saudável: ${data.sessionKey}`);
    });
    
    monitorManager.on('betDetected', async (eventData) => {
      console.log('🎯 Evento betDetected recebido:', eventData);
      
      try {
        const { userId, betData, groupConfig } = eventData;
        console.log(`🎯 Aposta detectada: ${userId} - ${betData.jogo}`);
        
        // Buscar dados do usuário para enviar notificação
        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            telegramCredentials: {
              where: { isActive: true },
              take: 1
            }
          }
        });
        
        if (!user || !user.telegramCredentials.length) {
          console.error('❌ Usuário ou credenciais não encontrados para notificação:', userId);
          return;
        }
        
        // Tentar resolver o Telegram ID a partir do perfil do usuário ou da credencial ativa
        const credTelegramId = user.telegramCredentials?.[0]?.telegramUserId;
        const resolvedTelegramId = user.telegramUserId ?? (credTelegramId ? (isNaN(Number(credTelegramId)) ? credTelegramId : Number(credTelegramId)) : undefined);
        
        if (!resolvedTelegramId) {
          console.error('❌ ID do Telegram não encontrado para o usuário:', userId);
          return;
        }
        
        console.log(`📧 Enviando notificação para usuário: ${user.email} (ID: ${resolvedTelegramId})`);
        
        // Criar mensagem de confirmação
        const confirmationMessage = `🎯 Aposta detectada e registrada!\n\n⚽️ Jogo: ${betData.jogo}\n⚽️ Placar: ${betData.placar ? normalizeScore(betData.placar) : 'Pré'}\n👥 Grupo: ${betData.groupName || '—'}\n📊 Mercado: ${betData.mercado}\n📈 Linha: ${betData.linha_da_aposta}\n💰 Odd Tipster: ${formatOddBrazilian(betData.odd_tipster)}${betData.stake !== undefined ? `\n📦 Stake: ${betData.stake}u` : ''}\n\n✅ Aposta já foi registrada na planilha\n\n💎 Responda esta mensagem com a odd real que você conseguiu\n(Digite 0 se não conseguiu pegar a aposta)`;
        
        // Enviar notificação via Telegram Bot API
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
          console.error('❌ TELEGRAM_BOT_TOKEN não configurado');
          return;
        }
        
        console.log('📤 Iniciando envio de notificação...');
        console.log('📋 Dados da notificação:', {
          userTelegramId: resolvedTelegramId,
          messageLength: confirmationMessage.length,
          betData: {
            jogo: betData.jogo,
            mercado: betData.mercado,
            oddTipster: betData.odd_tipster,
            betId: betData.betId
          }
        });
        
        const requestPayload = {
          chat_id: typeof resolvedTelegramId === 'bigint' ? resolvedTelegramId.toString() : resolvedTelegramId,
          text: confirmationMessage
        };
        
        console.log('🌐 Fazendo requisição para API do Telegram...');
        console.log('📡 URL:', `https://api.telegram.org/bot${botToken.substring(0, 10)}***/sendMessage`);
        console.log('📦 Payload:', {
          chat_id: requestPayload.chat_id,
          text_preview: requestPayload.text.substring(0, 100) + '...'
        });
        
        const startTime = Date.now();
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestPayload, (_key, value) => (typeof value === 'bigint' ? value.toString() : value))
        });
        
        const responseTime = Date.now() - startTime;
        console.log(`⏱️ Tempo de resposta da API: ${responseTime}ms`);
        console.log('📊 Status da resposta:', response.status, response.statusText);
        
        const result = await response.json();
        
        console.log('📋 Resposta completa da API:', JSON.stringify(result, null, 2));
        
        if (result.ok) {
          console.log('✅ Notificação enviada com sucesso!');
          console.log('✅ Message ID:', result.result.message_id);
          console.log('✅ Chat ID de destino:', result.result.chat.id);
          console.log('✅ Data de envio:', new Date(result.result.date * 1000).toISOString());
          
          // Salvar no cache compartilhado
          const betKey = `${resolvedTelegramId}_${result.result.message_id}`;
          SharedBetCache.saveBet(betKey, betData);
          console.log(`💾 Aposta salva no cache com chave: ${betKey}`);
          
          // Salvar na fila de monitoramento para aguardar resposta
          const botMessageId = result.result.message_id;
          
          // O multi-user-monitor.ts já cria um registro na monitor_queue.
          // Remover este bloco evita a duplicação de registros.
          /*
          await prisma.monitorQueue.create({
            data: {
              userId: userId,
              sessionId: `monitor_${Date.now()}`,
              messageData: JSON.stringify({
                betKey,
                ...betData
              }),
              status: 'PENDING',
              betId: betData.betId,
              jogo: betData.jogo,
              placar: betData.placar || '0-0',
              mercado: betData.mercado,
              linhaDaAposta: betData.linha_da_aposta,
              oddTipster: betData.odd_tipster,
              chatId: BigInt(groupConfig.chatId),
              messageId: BigInt(botMessageId)
            }
          });
          */
          
          console.log('💾 Aposta salva na fila de monitoramento');
        } else {
          console.error('❌ Falha ao enviar notificação!');
          console.error('❌ Código de erro:', result.error_code);
          console.error('❌ Descrição do erro:', result.description);
          console.error('❌ Resposta completa:', JSON.stringify(result, null, 2));
          
          // Log adicional para erros comuns
          if (result.error_code === 400) {
            console.error('💡 Erro 400: Verifique se o chat_id está correto e se o bot pode enviar mensagens para este usuário');
          } else if (result.error_code === 403) {
            console.error('💡 Erro 403: O usuário pode ter bloqueado o bot ou o bot não tem permissão para enviar mensagens');
          } else if (result.error_code === 429) {
            console.error('💡 Erro 429: Rate limit atingido. Aguarde antes de tentar novamente');
          }
        }
        
      } catch (error) {
        console.error('❌ [betDetected] Erro ao processar aposta detectada!');
        console.error('❌ [betDetected] Detalhes do erro:', {
          message: error instanceof Error ? error.message : 'Erro desconhecido',
          stack: error instanceof Error ? error.stack : 'N/A',
          userId: eventData?.userId,
          betData: eventData?.betData ? {
            jogo: eventData.betData.jogo,
            mercado: eventData.betData.mercado,
            betId: eventData.betData.betId
          } : 'N/A'
        });
        
        // Tentar notificar o usuário sobre o erro se possível
        if (eventData?.userId) {
          try {
            const user = await prisma.user.findUnique({
              where: { id: eventData.userId },
              include: {
                telegramCredentials: {
                  where: { isActive: true },
                  take: 1
                }
              }
            });
            
            // Resolver Telegram ID uma única vez (perfil do usuário OU credencial ativa)
            const credTelegramId = user?.telegramCredentials?.[0]?.telegramUserId;
            const resolvedTelegramId = user?.telegramUserId ?? (credTelegramId ? (isNaN(Number(credTelegramId)) ? credTelegramId : Number(credTelegramId)) : undefined);
            if (resolvedTelegramId) {
              await sendTelegramNotification(
                resolvedTelegramId,
                '❌ Erro ao processar aposta\n\nOcorreu um erro ao processar uma aposta detectada. Nossa equipe foi notificada.'
              );
              console.log('📤 [betDetected] Notificação de erro enviada ao usuário');
            } else {
              console.warn('⚠️ [betDetected] Não foi possível determinar o Telegram ID para notificação de erro do usuário:', eventData.userId);
            }
          } catch (notificationError) {
            console.error('❌ [betDetected] Falha ao enviar notificação de erro:', notificationError);
          }
        }
      }
    });
    
    // Configurar listener para replies (uma vez no início)
    await setupReplyListener();
    
    // Verificar e iniciar monitoramento para usuários com credenciais conectadas
    await startMonitoringForConnectedUsers(monitorManager);

    // Agendar verificação periódica de novas credenciais conectadas
    setInterval(async () => {
      try {
        await startMonitoringForConnectedUsers(monitorManager);
      } catch (err) {
        console.error('Erro ao verificar novas credenciais:', err);
      }
    }, 60000);
    
    monitorManager.on('messageProcessingError', (data) => {
      console.error(`❌ Erro no processamento: ${data.userId}`, data.error);
    });
    
    // Exibir estatísticas a cada 5 minutos
    setInterval(async () => {
      try {
        const stats = await monitorManager.getGeneralStats();
        console.log('📊 Estatísticas:', {
          sessoes_ativas: stats.activeSessions,
          grupos_monitorados: stats.totalGroups,
          apostas_24h: stats.recentBets,
          fila_processamento: Object.values(stats.queueStats).reduce((sum: number, count: unknown) => sum + (typeof count === 'number' ? count : 0), 0)
        });
      } catch (error) {
        console.error('Erro ao obter estatísticas:', error);
      }
    }, 300000); // 5 minutos
    
    // Configurar graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n🛑 Recebido sinal ${signal}. Iniciando shutdown graceful...`);
      
      try {
        await monitorManager.cleanup();
        await prisma.$disconnect();
        console.log('✅ Shutdown concluído com sucesso');
        process.exit(0);
      } catch (error) {
        console.error('❌ Erro durante shutdown:', error);
        process.exit(1);
      }
    };
    
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // Para nodemon
    
    // Manter o processo vivo
    console.log('🔄 Sistema de monitoramento em execução...');
    console.log('💡 Pressione Ctrl+C para parar');
    
  } catch (error) {
    console.error('❌ Erro ao inicializar sistema de monitoramento:', error);
    process.exit(1);
  }
}

// Função para configurar listener de replies
async function setupReplyListener() {
  console.log('🔧 Configurando listener para replies do bot...');
  
  // Sempre usar polling (mais simples e confiável)
  console.log('🔄 Usando polling para replies');
  
  // Remover webhook se existir
  try {
    await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/deleteWebhook`,
      { method: 'POST' }
    );
    console.log('🗑️ Webhook removido');
  } catch (error) {
    console.log('⚠️ Aviso ao remover webhook:', error);
  }
  
  // Iniciar polling para replies
  startReplyPolling();
}

// Função para processar reply com odd
let lastUpdateId = 0;

async function startReplyPolling() {
  console.log('🔄 Iniciando polling para replies...');
  
  const pollInterval = setInterval(async () => {
    try {
      // Buscar updates do Telegram com timeout personalizado
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos timeout
      
      const response = await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=5`,
        {
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      clearTimeout(timeoutId);
      
      const data = await response.json();
      
      if (data.ok && data.result.length > 0) {
        for (const update of data.result) {
          lastUpdateId = update.update_id;

          // 1) Processar comandos em chat privado para vincular o usuário (/start <token>) ou informar o ID (/id)
          if (update.message && update.message.text) {
            const message = update.message;
            const chatType = message.chat?.type;
            const text = (message.text || '').trim();

            if (chatType === 'private') {
              // /id -> retorna o ID do usuário no Telegram
              if (/^\/id\b/i.test(text)) {
                try {
                  await sendTelegramNotification(message.from.id, `🆔 Seu ID do Telegram é: ${message.from.id}`);
                } catch (e) {
                  console.error('❌ [polling:/id] Falha ao responder com ID do Telegram:', e);
                }
                continue; // próximo update
              }

              // /start [token]
              if (/^\/start\b/i.test(text)) {
                const token = text.replace(/^\/start\s*/i, '').trim();
                console.log('🔗 [polling:/start] Recebido /start em privado. Token:', token || '<vazio>');

                try {
                  if (!token) {
                    await sendTelegramNotification(
                      message.from.id,
                      '👋 Olá! Para vincular sua conta, acesse o painel do Autosheets e clique em "Conectar Telegram" para gerar seu link.\n\nComo alternativa, você pode enviar:\n/start SEU_EMAIL\n\nExemplo:\n/start usuario@dominio.com'
                    );
                    continue;
                  }

                  // Tentar localizar o usuário pelo token informado
                  let user = null as any;
                  if (token.includes('@')) {
                    // Tratar token como email
                    user = await prisma.user.findUnique({ where: { email: token } });
                  } else {
                    // Tratar token como userId (UUID)
                    user = await prisma.user.findUnique({ where: { id: token } });
                  }

                  if (!user) {
                    console.warn('⚠️ [polling:/start] Usuário não encontrado para token:', token);
                    await sendTelegramNotification(
                      message.from.id,
                      '❌ Não foi possível vincular sua conta. Token inválido.\n\nDicas:\n- Use o link do painel para gerar o comando /start correto;\n- Ou envie: /start SEU_EMAIL'
                    );
                    continue;
                  }

                  // Atualizar telegramUserId do usuário
                  const previousId = user.telegramUserId;
                  await prisma.user.update({
                    where: { id: user.id },
                    data: { telegramUserId: message.from.id }
                  });

                  console.log(`✅ [polling:/start] Vinculação concluída. userId=${user.id}, antigo=${previousId}, novo=${message.from.id}`);
                  await sendTelegramNotification(
                    message.from.id,
                    '✅ Sua conta foi vinculada com sucesso ao bot!\nVocê passará a receber notificações automáticas aqui.'
                  );
                  continue; // próximo update
                } catch (e) {
                  console.error('❌ [polling:/start] Erro ao processar vinculação:', e);
                  try {
                    await sendTelegramNotification(
                      message.from.id,
                      '❌ Ocorreu um erro ao tentar vincular sua conta. Tente novamente em alguns instantes.'
                    );
                  } catch {}
                  continue; // próximo update
                }
              }
            }
          }

          // 2) Processar apenas mensagens com reply_to_message (lógica existente)
          if (update.message && update.message.reply_to_message && update.message.text) {
            const message = update.message;
            const replyToMessageId = message.reply_to_message.message_id;
            const userId = message.from.id;
            const chatId = message.chat.id;
            const oddText = message.text.trim();
            
            console.log(`🎯 Reply detectado via polling: ${userId} respondeu "${oddText}" à mensagem ${replyToMessageId}`);

            // Processar o reply
            await processOddReply(userId, replyToMessageId, oddText, chatId);
          }
        }
      }
    } catch (error) {
      console.error('Erro no polling de replies:', error);
    }
  }, 3000);
}

// Helper: extract stake from reply text and return cleaned text without stake tokens
function extractStakeFromReply(text: string): { stake?: number; cleaned: string } {
  let cleaned = text;
  let stake: number | undefined = undefined;

  // "meia unidade" => 0.5
  if (/\bmeia\s+unidade\b/i.test(cleaned)) {
    stake = 0.5;
    cleaned = cleaned.replace(/\bmeia\s+unidade\b/gi, ' ');
  }

  // "stake: 1.5" ou "stake 1,5"
  const mStakeWord = cleaned.match(/stake\s*[:=]?\s*(\d+[.,]?\d*)/i);
  if (mStakeWord) {
    const n = parseFloat(mStakeWord[1].replace(',', '.'));
    if (Number.isFinite(n) && n >= 0) stake = n;
    cleaned = cleaned.replace(mStakeWord[0], ' ');
  }

  // "2u" ou "0,5u"
  cleaned = cleaned.replace(/\b(\d+[.,]?\d*)\s*u\b/gi, (match, p1) => {
    if (stake === undefined) {
      const n = parseFloat(String(p1).replace(',', '.'));
      if (Number.isFinite(n) && n >= 0) stake = n;
    }
    return ' ';
  });

  // "2 unidades" ou "1 unidade"
  cleaned = cleaned.replace(/\b(\d+[.,]?\d*)\s*unidades?\b/gi, (match, p1) => {
    if (stake === undefined) {
      const n = parseFloat(String(p1).replace(',', '.'));
      if (Number.isFinite(n) && n >= 0) stake = n;
    }
    return ' ';
  });

  return { stake, cleaned: cleaned.trim() };
}

// Helper: extract odd value from text (supports "@1.85", "odd 1.85" or bare number like "1.85" or "0")
function extractOddFromReply(text: string): number {
  const atMatch = text.match(/@\s*(\d+[.,]?\d*)/);
  if (atMatch) return parseFloat(atMatch[1].replace(',', '.'));

  const oddWord = text.match(/odd\s*[:=]?\s*(\d+[.,]?\d*)/i);
  if (oddWord) return parseFloat(oddWord[1].replace(',', '.'));

  const firstNumber = text.match(/(\d+[.,]?\d*)/);
  if (firstNumber) return parseFloat(firstNumber[1].replace(',', '.'));

  return NaN;
}

async function processOddReply(telegramUserId: number, messageId: number, oddText: string, chatId: number) {
  const betKey = `${telegramUserId}_${messageId}`;
  console.log(`📊 [processOddReply] Iniciando processamento de reply...`);
  console.log(`📋 [processOddReply] Parâmetros: telegramUserId=${telegramUserId}, messageId=${messageId}, chatId=${chatId}, betKey=${betKey}, oddText="${oddText}"`);
  
  // Buscar aposta no cache
  console.log(`🔍 [processOddReply] Buscando aposta no cache com chave: ${betKey}`);
  const betData = SharedBetCache.getBet(betKey);
  
  if (!betData) {
    console.log(`❌ [processOddReply] Aposta não encontrada no cache para chave: ${betKey}`);
    return;
  }
  
  console.log(`✅ [processOddReply] Aposta encontrada no cache: ${betKey}`);
  console.log(`📋 [processOddReply] Resumo da aposta: jogo="${betData.jogo}", mercado="${betData.mercado}", oddTipster=${betData.odd_tipster}, betId=${betData.betId}`);
  
  // Extrair stake (opcional) do texto da reply e limpar texto para extrair odd
  const { stake: stakeOverride, cleaned } = extractStakeFromReply(oddText);
  if (stakeOverride !== undefined) {
    console.log(`💰 [processOddReply] Stake override detectado na reply:`, stakeOverride);
  }

  // Processar odd a partir do texto limpo
  const oddReal = extractOddFromReply(cleaned);
  console.log(`📊 [processOddReply] Processamento de odd:`, {
    oddTextoOriginal: oddText,
    oddTextoLimpo: cleaned,
    oddProcessada: oddReal,
    isValid: !isNaN(oddReal) && oddReal >= 0
  });
  
  try {
    // Buscar usuário no banco
    console.log(`🔍 [processOddReply] Buscando usuário no banco com telegramUserId: ${telegramUserId}`);
    const user = await prisma.user.findFirst({
      where: {
        telegramUserId: telegramUserId
      }
    });
    
    if (!user) {
      console.error(`❌ [processOddReply] Usuário não encontrado para telegramUserId: ${telegramUserId}`);
      return;
    }
    
    console.log(`✅ [processOddReply] Usuário encontrado:`, {
      id: user.id,
      email: user.email,
      telegramUserId: user.telegramUserId
    });
    
    // Buscar planilha ativa do usuário
    console.log(`🔍 [processOddReply] Buscando planilha ativa para usuário: ${user.id}`);
    const spreadsheetManager = new SpreadsheetManager();
    const userSpreadsheetId = await spreadsheetManager.getUserActiveSpreadsheet(user.id);
    
    if (!userSpreadsheetId) {
      console.error(`❌ [processOddReply] Usuário não possui planilha ativa: ${user.id}`);
      return;
    }
    
    console.log(`✅ [processOddReply] Planilha ativa encontrada: ${userSpreadsheetId}`);
    
    // Configurar serviço de planilhas
    const sheetsConfig = {
              spreadsheetId: userSpreadsheetId,
              range: 'Dados!A:M',
              credentials: {
                client_email: process.env.GOOGLE_CLIENT_EMAIL!,
                private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
              },
            };
    
    const sheetsService = new GoogleSheetsService(sheetsConfig);
    
    // Aplicar stake override (se fornecido)
    if (stakeOverride !== undefined) {
      betData.stake = stakeOverride;
    }
    
    if (oddReal === 0) {
      // Aposta não foi pega
      betData.pegou = false;
      betData.odd_real = null;
      
      console.log(`💾 [processOddReply] Atualizando aposta como NÃO PEGA na planilha (betId: ${betData.betId})`);
      console.log(`📋 [processOddReply] Dados para atualização:`, {
        betId: betData.betId,
        oddReal: null,
        pegou: false,
        stake: betData.stake
      });
      const success = await sheetsService.updateBetOddByBetId(betData.betId!, null, betData.stake);
      
      if (success) {
        await sendTelegramNotification(
          telegramUserId,
          `❌ Aposta não realizada**\n\n` +
          `⚽️ Jogo: ${betData.jogo}\n` +
          `⚽️ Placar: ${betData.placar ? normalizeScore(betData.placar) : 'Pré'}\n` +
          `📊 Mercado: ${betData.mercado}\n` +
          `📈 Linha: ${betData.linha_da_aposta}\n` +
          `💰 Odd Tipster: ${formatOddBrazilian(betData.odd_tipster)}
          ${betData.stake !== undefined ? `\n🎯 **Stake:** ${betData.stake}` : ''}` +
          `\n\n✅ Planilha atualizada - aposta não foi pega.`
        );
        console.log('✅ Aposta marcada como não realizada e atualizada na planilha');
        
        // Remover da fila de monitoramento usando betId
        try {
          if (betData.betId) {
            const deleteResult = await prisma.monitorQueue.deleteMany({
              where: { userId: user.id, betId: betData.betId }
            });
            console.log(`🗑️ [processOddReply] Removidos ${deleteResult.count} itens da MonitorQueue para betId ${betData.betId}`);
          } else {
            console.warn('⚠️ [processOddReply] betId ausente - não foi possível remover da MonitorQueue');
          }
        } catch (queueError) {
          console.error('❌ [processOddReply] Erro ao remover item da MonitorQueue:', queueError);
        }
      } else {
        console.error('❌ Erro ao atualizar aposta não realizada na planilha');
      }
    } else if (!isNaN(oddReal) && oddReal > 0) {
      // Aposta foi pega com odd válida
      betData.pegou = true;
      betData.odd_real = oddReal;
      
      console.log(`💾 [processOddReply] Atualizando aposta PEGA na planilha (betId: ${betData.betId})`);
      console.log(`📋 [processOddReply] Dados para atualização:`, {
        betId: betData.betId,
        oddReal: oddReal,
        pegou: true,
        stake: betData.stake
      });
      
      const success = await sheetsService.updateBetOddByBetId(betData.betId!, oddReal, betData.stake);
      
      if (success) {
        await sendTelegramNotification(
          telegramUserId,
          `✅ Aposta atualizada com sucesson\n` +
          `⚽️ Jogo: ${betData.jogo}\n` +
          `⚽️ Placar: ${betData.placar ? normalizeScore(betData.placar) : 'Pré'}\n` +
          `👥 Grupo: ${betData.groupName || '—'}\n` +
          `📊 Mercado: ${betData.mercado}\n` +
          `📈 Linha: ${betData.linha_da_aposta}\n` +
          `💰 Odd Tipster: ${formatOddBrazilian(betData.odd_tipster)}\n` +
          `💎 Odd Real: ${formatOddBrazilian(betData.odd_real)}\n` +
          `📊 Stake: ${betData.stake}`
        );
        
        console.log('✅ [processOddReply] Aposta atualizada com sucesso na planilha');

        // Remover da fila de monitoramento usando betId
        try {
          if (betData.betId) {
            const deleteResult = await prisma.monitorQueue.deleteMany({
              where: { userId: user.id, betId: betData.betId }
            });
            console.log(`🗑️ [processOddReply] Removidos ${deleteResult.count} itens da MonitorQueue para betId ${betData.betId}`);
          } else {
            console.warn('⚠️ [processOddReply] betId ausente - não foi possível remover da MonitorQueue');
          }
        } catch (queueError) {
          console.error('❌ [processOddReply] Erro ao remover item da MonitorQueue:', queueError);
        }
      } else {
        console.error('❌ [processOddReply] Erro ao atualizar aposta na planilha');
      }
    } else {
      // Odd inválida
      console.log(`❌ [processOddReply] Odd inválida recebida:`, {
        oddText,
        oddTextCleaned: cleaned,
        oddReal,
        isNaN: isNaN(oddReal),
        isPositive: oddReal > 0
      });
      
      console.log(`📤 [processOddReply] Enviando mensagem de erro para usuário: ${telegramUserId}`);
      await sendTelegramNotification(
        telegramUserId,
        `❌ **Odd inválida**\n\n` +
        `Por favor, responda com um número válido ou 0 para "não peguei".` +
        `\n\nExemplos: 1.85, 2.50, 0` +
        `${stakeOverride !== undefined ? `\n\nℹ️ Observação: Detectamos um stake na sua resposta (${stakeOverride}), mas é necessário informar a odd também.` : ''}`
      );
      console.log(`🔄 [processOddReply] Mantendo aposta no cache para nova tentativa`);
      return; // Não remove do cache
    }
    
    // Remover do cache após processamento bem-sucedido
    console.log(`🗑️ [processOddReply] Removendo aposta do cache: ${betKey}`);
    SharedBetCache.removeBet(betKey);
    
  } catch (error) {
    console.error('❌ [processOddReply] Erro ao processar reply de odd!');
    console.error('❌ [processOddReply] Detalhes do erro:', {
      message: error instanceof Error ? error.message : 'Erro desconhecido',
      stack: error instanceof Error ? error.stack : 'N/A',
      telegramUserId,
      messageId,
      oddText,
      betKey
    });
    
    // Tentar enviar notificação de erro para o usuário
    try {
      await sendTelegramNotification(
        telegramUserId,
        `❌ **Erro interno**\n\nOcorreu um erro ao processar sua resposta. Tente novamente em alguns minutos.`
      );
      console.log('📤 [processOddReply] Notificação de erro enviada ao usuário');
    } catch (notificationError) {
      console.error('❌ [processOddReply] Falha ao enviar notificação de erro:', notificationError);
    }
  }
}

// Função para enviar notificação via Telegram Bot API
async function sendTelegramNotification(userTelegramId: string | number | bigint, message: string): Promise<any> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error('❌ TELEGRAM_BOT_TOKEN não configurado');
    return;
  }
  
  console.log('📤 [sendTelegramNotification] Iniciando envio...');
  console.log('📋 [sendTelegramNotification] Parâmetros:', {
    userTelegramId,
    messageLength: message.length,
    messagePreview: message.substring(0, 100) + '...'
  });
  
  try {
    const requestPayload = {
      chat_id: typeof userTelegramId === 'bigint' ? userTelegramId.toString() : userTelegramId,
      text: message
    };
    
    console.log('🌐 [sendTelegramNotification] Fazendo requisição para API do Telegram...');
    console.log('📡 [sendTelegramNotification] URL:', `https://api.telegram.org/bot${botToken.substring(0, 10)}***/sendMessage`);
    
    const startTime = Date.now();
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload, (_key, value) => (typeof value === 'bigint' ? value.toString() : value))
    });
    
    const responseTime = Date.now() - startTime;
    console.log(`⏱️ [sendTelegramNotification] Tempo de resposta: ${responseTime}ms`);
    console.log('📊 [sendTelegramNotification] Status:', response.status, response.statusText);
    
    const result = await response.json();
    console.log('📋 [sendTelegramNotification] Resposta da API:', JSON.stringify(result, null, 2));
    
    if (result.ok) {
      console.log('✅ [sendTelegramNotification] Notificação enviada com sucesso!');
      console.log('✅ [sendTelegramNotification] Message ID:', result.result.message_id);
      console.log('✅ [sendTelegramNotification] Chat ID:', result.result.chat.id);
    } else {
      console.error('❌ [sendTelegramNotification] Falha ao enviar notificação!');
      console.error('❌ [sendTelegramNotification] Código de erro:', result.error_code);
      console.error('❌ [sendTelegramNotification] Descrição:', result.description);
      
      // Log adicional para erros comuns
      if (result.error_code === 400) {
        console.error('💡 [sendTelegramNotification] Erro 400: Verifique o chat_id e permissões');
      } else if (result.error_code === 403) {
        console.error('💡 [sendTelegramNotification] Erro 403: Usuário bloqueou o bot ou sem permissão');
      } else if (result.error_code === 429) {
        console.error('💡 [sendTelegramNotification] Erro 429: Rate limit atingido');
      }
    }
    
    return result;
  } catch (error) {
    console.error('❌ [sendTelegramNotification] Erro na requisição:', error);
    console.error('❌ [sendTelegramNotification] Stack trace:', error instanceof Error ? error.stack : 'N/A');
    return null;
  }
}

// Verificar se está sendo executado diretamente
if (require.main === module) {
  startMultiUserMonitor();
}

export default startMultiUserMonitor;