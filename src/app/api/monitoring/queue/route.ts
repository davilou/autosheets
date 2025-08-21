import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import AuthService from '@/lib/auth/service';
import MonitorManager from '@/lib/telegram/monitor-manager';
import { SharedBetCache } from '@/lib/shared/bet-cache';
import SpreadsheetManager from '@/lib/spreadsheets/manager';
import GoogleSheetsService from '@/lib/sheets/service';
import { normalizeScore } from '@/lib/utils';

const authService = new AuthService();
const monitorManager = MonitorManager.getInstance();
const sharedBetCache = new SharedBetCache();
const spreadsheetManager = new SpreadsheetManager();

// Função para converter BigInt para string
function convertBigIntToString(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  
  if (obj instanceof Date) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(convertBigIntToString);
  }
  
  if (typeof obj === 'object') {
    const converted: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        converted[key] = convertBigIntToString(obj[key]);
      }
    }
    return converted;
  }
  
  return obj;
}

// Função de autenticação
async function authenticate(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    const token = authHeader.substring(7);
    const result = await authService.verifyToken(token);
    
    if (result.success && result.user) {
      return result.user;
    }
    
    return null;
  } catch (error) {
    console.error('Erro na autenticação:', error);
    return null;
  }
}

// GET - Buscar itens da fila
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const targetUserId = userId || user.id;

    console.log('🔍 Debug Queue Access:', {
      userIdFromToken: user.id,
      userIdFromQuery: userId,
      targetUserId,
      comparison: userId === user.id
    });

    // Verificar se o usuário tem acesso
    if (userId && userId !== user.id) {
      console.log('❌ Acesso negado - userId não confere');
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Buscar itens da fila
    const queueItems = await prisma.monitorQueue.findMany({
      where: {
        userId: targetUserId,
        status: { in: ['PROCESSING', 'RETRYING', 'COMPLETED', 'FAILED'] }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' }
      ],
      take: 50
    });

    // Buscar apostas pendentes na fila (status PENDING e COMPLETED)
    const pendingBets = await prisma.monitorQueue.findMany({
      where: {
        userId: targetUserId,
        status: { in: ['PENDING', 'COMPLETED'] }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    // Filtrar apostas processadas do usuário
    const userPendingBets = pendingBets.filter(item => {
      try {
        const messageData = item.messageData ? JSON.parse(item.messageData) : null;
        return messageData && messageData.chatId;
      } catch {
        return false;
      }
    });

    // Formatar apostas pendentes
    const formattedPendingBets = userPendingBets.map(item => {
      let messageData = null;
      try {
        messageData = item.messageData ? JSON.parse(item.messageData) : null;
      } catch (error) {
        console.error('Erro ao fazer parse do messageData:', error);
      }

      return {
        key: messageData?.betKey || `queue_${item.id}`,
        id: item.id,
        messageData: item.messageData,
        status: item.status,
        betData: {
          jogo: messageData?.processedData?.jogo || item.jogo || 'Processando...',
          mercado: messageData?.processedData?.mercado || item.mercado || 'Detectando...',
          linha_da_aposta: messageData?.processedData?.linha_da_aposta || item.linhaDaAposta || 'Analisando...',
          odd_tipster: messageData?.processedData?.odd_tipster || item.oddTipster || 'Detectando...',
          placar: messageData?.processedData?.placar ? normalizeScore(messageData?.processedData?.placar) : '0-0',
          data: (() => {
            // Priorizar data dos dados processados, depois messageData geral, por último createdAt
            const dataValue = messageData?.processedData?.data || messageData?.data || item.createdAt;
            const date = new Date(dataValue);
            return isNaN(date.getTime()) ? new Date() : date;
          })(),
          oddReal: item.oddReal,
          pegou: item.pegou,
          resultado: item.resultado,
          lucroPrejuizo: item.lucroPrejuizo,
          createdAt: item.createdAt
        }
      };
    });

    // Buscar apostas da fila do usuário
    const userQueueBets = await prisma.monitorQueue.findMany({
      where: {
        userId: targetUserId,
        status: { in: ['PENDING', 'COMPLETED'] }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    const userQueuePendingBets = userQueueBets.map(queueItem => {
      let messageData = null;
      try {
        messageData = queueItem.messageData ? JSON.parse(queueItem.messageData) : null;
      } catch (error) {
        console.error('Erro ao fazer parse do messageData:', error);
      }

      return {
        key: `queue_${queueItem.id}`,
        betData: {
          id: queueItem.id,
          jogo: messageData?.processedData?.jogo || 'N/A',
          mercado: messageData?.processedData?.mercado || 'N/A',
          linha_da_aposta: messageData?.processedData?.linha_da_aposta || 'N/A',
          odd_tipster: messageData?.processedData?.odd_tipster || 'N/A',
          placar: messageData?.processedData?.placar ? normalizeScore(messageData.processedData.placar) : '0-0',
          data: (() => {
            // Priorizar data dos dados processados, depois messageData geral, por último createdAt
            const dataValue = messageData?.processedData?.data || messageData?.data || queueItem.createdAt;
            const date = new Date(dataValue);
            return isNaN(date.getTime()) ? new Date() : date;
          })(),
          hora: messageData?.processedData?.hora || new Date().toTimeString().split(' ')[0],
          status: queueItem.status,
          createdAt: queueItem.createdAt,
          messageText: messageData?.text || 'Texto não disponível',
          chatId: messageData?.chatId || 'N/A'
        },
        messageData: queueItem.messageData,
        status: queueItem.status
      };
    });

    // Processar itens da fila
    let processedQueueItems = queueItems.map(item => ({
      ...item,
      ...convertBigIntToString(item)
    }));

    // Converter BigInt para string
    processedQueueItems = processedQueueItems.map(item => ({
      ...item,
      id: item.id.toString(),
      userId: item.userId.toString(),
      chatId: item.chatId ? item.chatId.toString() : null,
      senderId: item.senderId ? item.senderId.toString() : null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      processedAt: item.processedAt
    }));

    // Estatísticas da fila
    const queueStats = await prisma.monitorQueue.groupBy({
      by: ['status'],
      where: { userId: targetUserId },
      _count: { status: true }
    });

    const queueStatsByStatus = queueStats.reduce((acc, stat) => {
      acc[stat.status] = stat._count.status;
      return acc;
    }, {} as Record<string, number>);

    const totalPending = queueStatsByStatus['PENDING'] || 0;
    const totalProcessing = queueStatsByStatus['PROCESSING'] || 0;
    const totalCompleted = queueStatsByStatus['COMPLETED'] || 0;
    const totalFailed = queueStatsByStatus['FAILED'] || 0;

    console.log('🔍 Debug Pending Bets:', {
      totalPendingBets: pendingBets.length,
      userPendingBets: userPendingBets.length,
      formattedPendingBets: formattedPendingBets.length,
      userQueuePendingBets: userQueuePendingBets.length,
      targetUserId
    });

    const responseData = {
      queueItems: processedQueueItems,
      pendingBets: formattedPendingBets,
      userQueuePendingBets,
      stats: {
        totalPending,
        totalProcessing,
        totalCompleted,
        totalFailed
      },
      timestamp: new Date()
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Erro ao buscar fila:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Processar ações da fila
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { action, userId, betKeys, betId, oddReal, stake } = body;

    // Verificar se o usuário tem acesso
    if (userId && userId !== user.id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const targetUserId = userId || user.id;

    if (action === 'sendToSpreadsheet' || action === 'process_all') {
      // NOVO FLUXO: Não há mais processamento automático
      // As apostas já são adicionadas à planilha quando detectadas pelo Gemini Parser
      // A fila agora contém apenas apostas aguardando odd real
      
      return NextResponse.json({
        message: 'As apostas já são processadas automaticamente quando detectadas. Use process_with_odd para atualizar odds reais.',
        processedCount: 0,
        errors: [],
        timestamp: new Date()
      });
    }

    // NOVO: Deletar múltiplos itens selecionados
    if (action === 'delete_selected') {
      const { betIds } = body as { betIds: string[] };
      if (!Array.isArray(betIds) || betIds.length === 0) {
        return NextResponse.json(
          { error: 'betIds é obrigatório e deve ser uma lista' },
          { status: 400 }
        );
      }

      const deleted = await prisma.monitorQueue.deleteMany({
        where: {
          id: { in: betIds },
          userId: targetUserId
        }
      });

      return NextResponse.json({
        message: `${deleted.count} itens removidos da fila`,
        deletedCount: deleted.count,
        timestamp: new Date()
      });
    }
    
    if (action === 'process_with_odd') {
      // Processar aposta específica com odd fornecida pelo usuário
      if (!betId || oddReal === undefined) {
        return NextResponse.json(
          { error: 'betId e oddReal são obrigatórios' },
          { status: 400 }
        );
      }

      const SpreadsheetManagerClass = (await import('@/lib/spreadsheets/manager')).default;
      const GoogleSheetsServiceClass = (await import('@/lib/sheets/service')).default;

      const spreadsheetManager = new SpreadsheetManagerClass();
      
      // Buscar a planilha ativa do usuário
      const userSpreadsheetId = await spreadsheetManager.getUserActiveSpreadsheet(targetUserId);
      
      if (!userSpreadsheetId) {
        return NextResponse.json(
          { error: 'Usuário não possui planilha ativa' },
          { status: 400 }
        );
      }

      // Configurar o serviço do Google Sheets
      const sheetsConfig = {
      spreadsheetId: userSpreadsheetId,
      range: 'Dados!A:M',
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL!,
        private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      },
    };
      
      const sheetsService = new GoogleSheetsServiceClass(sheetsConfig);

      try {
        // Buscar o item da fila (independente do status)
        const queueItem = await prisma.monitorQueue.findFirst({
          where: {
            id: betId,
            userId: targetUserId
          }
        });

        if (!queueItem) {
          return NextResponse.json(
            { error: 'Aposta não encontrada' },
            { status: 404 }
          );
        }

        // Parse dos dados da mensagem (se existir)
        let messageData: any = null;
        try {
          messageData = queueItem.messageData ? JSON.parse(queueItem.messageData) : null;
        } catch (parseError) {
          console.error('Erro ao fazer parse do messageData:', parseError);
        }

        // Determinar o betId original salvo quando a aposta foi criada
        const originalBetId = (queueItem.betId || messageData?.processedData?.betId || messageData?.betId);
        if (!originalBetId) {
          return NextResponse.json(
            { error: 'BetId não encontrado para este item da fila' },
            { status: 400 }
          );
        }

        const finalOdd = oddReal > 0 ? oddReal : null;
        console.log('💾 Atualizando aposta na planilha (betId original:', String(originalBetId), ')');
        const success = await sheetsService.updateBetOddByBetId(String(originalBetId), finalOdd, stake);
         
         if (!success) {
          return NextResponse.json(
            { error: `Aposta com betId ${String(originalBetId)} não encontrada na planilha para atualização` },
            { status: 404 }
          );
        }
        
        // Remover item da fila após processamento bem-sucedido
        await prisma.monitorQueue.delete({
          where: { id: queueItem.id }
        });

        // NOVO: Limpar aposta do SharedBetCache para evitar conflitos com replies
        try {
          if (messageData?.chatId && messageData?.messageId) {
            // Tentar múltiplos formatos de chave do cache
            const possibleCacheKeys = [
              `${targetUserId}_${messageData.messageId}`,
              `${messageData.senderId}_${messageData.messageId}`,
              `${messageData.chatId}_${messageData.messageId}`
            ];
            
            let cacheKeyRemoved = false;
            for (const cacheKey of possibleCacheKeys) {
              const cachedBet = SharedBetCache.getBet(cacheKey);
              if (cachedBet) {
                SharedBetCache.removeBet(cacheKey);
                console.log(`🗑️ Aposta removida do cache: ${cacheKey}`);
                cacheKeyRemoved = true;
                break;
              }
            }
            
            // Fallback: procurar por betId em todas as chaves se não encontrou diretamente
            if (!cacheKeyRemoved) {
              try {
                const allCached = SharedBetCache.getAllBets?.();
                if (allCached && typeof allCached === 'object') {
                  for (const [key, value] of Object.entries<any>(allCached)) {
                    const valueBetId = value?.betId || value?.processedData?.betId;
                    if (String(valueBetId) === String(originalBetId)) {
                      SharedBetCache.removeBet(key);
                      console.log(`🗑️ Aposta removida do cache via fallback por betId (${originalBetId}): ${key}`);
                      cacheKeyRemoved = true;
                      break;
                    }
                  }
                }
              } catch (scanErr) {
                console.warn('Não foi possível varrer todas as chaves do cache para fallback:', scanErr);
              }
            }

            if (!cacheKeyRemoved) {
              console.log(`⚠️ Aposta não encontrada no cache para limpeza. Chaves testadas: ${possibleCacheKeys.join(', ')}`);
            }
          } else {
            console.log(`⚠️ Dados insuficientes para limpar cache (chatId: ${messageData?.chatId}, messageId: ${messageData?.messageId})`);
          }
        } catch (cacheError) {
          console.error('❌ Erro ao limpar cache:', cacheError);
          // Não interromper o fluxo principal se houver erro na limpeza do cache
        }

        // Construir dados de resposta usando o que já temos (sem reprocessar via Gemini)
        const processed = messageData?.processedData || {};
        return NextResponse.json({
          message: 'Odd real atualizada na planilha com sucesso',
          betData: {
            jogo: processed.jogo || queueItem.jogo || 'N/A',
            mercado: processed.mercado || queueItem.mercado || 'N/A',
            linha_da_aposta: processed.linha_da_aposta || queueItem.linhaDaAposta || 'N/A',
            odd_tipster: processed.odd_tipster || queueItem.oddTipster || 'N/A',
            odd_real: finalOdd,
            pegou: finalOdd && finalOdd > 0 ? 'Sim' : 'Não',
            betId: String(originalBetId)
          },
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Erro ao processar aposta com odd:', error);
        return NextResponse.json(
          { error: 'Erro interno do servidor' },
          { status: 500 }
        );
      }
    }

    // NOVO: Processar múltiplas apostas com odds/stakes
    if (action === 'process_multiple_with_odds') {
      const { items } = body as { items: Array<{ betId: string; oddReal: number; stake?: number }>; };
      if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json(
          { error: 'items é obrigatório e deve ser uma lista' },
          { status: 400 }
        );
      }

      const SpreadsheetManagerClass = (await import('@/lib/spreadsheets/manager')).default;
      const GoogleSheetsServiceClass = (await import('@/lib/sheets/service')).default;

      const spreadsheetManager = new SpreadsheetManagerClass();
      const userSpreadsheetId = await spreadsheetManager.getUserActiveSpreadsheet(targetUserId);
      if (!userSpreadsheetId) {
        return NextResponse.json(
          { error: 'Usuário não possui planilha ativa' },
          { status: 400 }
        );
      }

      const sheetsConfig = {
        spreadsheetId: userSpreadsheetId,
        range: 'Dados!A:M',
        credentials: {
          client_email: process.env.GOOGLE_CLIENT_EMAIL!,
          private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        },
      };
      const sheetsService = new GoogleSheetsServiceClass(sheetsConfig);

      const results: Array<{ betId: string; success: boolean; error?: string }> = [];

      for (const item of items) {
        try {
          const queueItem = await prisma.monitorQueue.findFirst({
            where: { id: item.betId, userId: targetUserId }
          });
          if (!queueItem) {
            results.push({ betId: item.betId, success: false, error: 'Aposta não encontrada' });
            continue;
          }

          let messageData: any = null;
          try {
            messageData = queueItem.messageData ? JSON.parse(queueItem.messageData) : null;
          } catch {}

          const originalBetId = (queueItem.betId || messageData?.processedData?.betId || messageData?.betId);
          if (!originalBetId) {
            results.push({ betId: item.betId, success: false, error: 'BetId original não encontrado' });
            continue;
          }

          const finalOdd = item.oddReal > 0 ? item.oddReal : null;
          const success = await sheetsService.updateBetOddByBetId(String(originalBetId), finalOdd, item.stake);
          if (!success) {
            results.push({ betId: item.betId, success: false, error: 'Não encontrada na planilha' });
            continue;
          }

          await prisma.monitorQueue.delete({ where: { id: queueItem.id } });

          // Limpeza de cache best-effort
          try {
            if (messageData?.chatId && messageData?.messageId) {
              const possibleCacheKeys = [
                `${targetUserId}_${messageData.messageId}`,
                `${messageData.senderId}_${messageData.messageId}`,
                `${messageData.chatId}_${messageData.messageId}`
              ];
              for (const cacheKey of possibleCacheKeys) {
                const cachedBet = SharedBetCache.getBet(cacheKey);
                if (cachedBet) {
                  SharedBetCache.removeBet(cacheKey);
                  break;
                }
              }
            }
          } catch {}

          results.push({ betId: item.betId, success: true });
        } catch (err: any) {
          results.push({ betId: item.betId, success: false, error: err?.message || 'Erro desconhecido' });
        }
      }

      const processedCount = results.filter(r => r.success).length;
      return NextResponse.json({
        message: `${processedCount} apostas processadas com sucesso`,
        processedCount,
        results,
        timestamp: new Date()
      });
    }

    if (action === 'processQueue') {
      // Processar fila de mensagens manualmente
      const pendingItems = await prisma.monitorQueue.findMany({
        where: {
          userId: targetUserId,
          status: 'PENDING'
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' }
        ],
        take: 10 // Processar até 10 itens por vez
      });
      
      let processedCount = 0;
      
      for (const item of pendingItems) {
        try {
          // Marcar como processando
          await prisma.monitorQueue.update({
            where: { id: item.id },
            data: {
              status: 'PROCESSING',
              processedAt: new Date()
            }
          });
          
          // Aqui seria implementada a lógica de processamento
          // Por enquanto, apenas remover da fila
          await prisma.monitorQueue.delete({
            where: { id: item.id }
          });
          
          processedCount++;
        } catch (error) {
          console.error(`Erro ao processar item ${item.id}:`, error);
          
          // Marcar como falha
          await prisma.monitorQueue.update({
            where: { id: item.id },
            data: {
              status: 'FAILED',
              errorMessage: error instanceof Error ? error.message : 'Erro desconhecido',
              attempts: { increment: 1 }
            }
          });
        }
      }
      
      return NextResponse.json({
        message: `${processedCount} itens processados da fila`,
        processedCount,
        timestamp: new Date()
      });
    }
    
    return NextResponse.json(
      { error: 'Ação não reconhecida' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Erro ao processar ação da fila:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Limpar itens da fila
export async function DELETE(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    const olderThan = searchParams.get('olderThan'); // em horas
    const targetUserId = userId || user.id;

    // Verificar se o usuário tem acesso
    if (userId !== user.id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const whereClause: any = { userId };
    
    if (status) {
      whereClause.status = status;
    }
    
    if (olderThan) {
      const hoursAgo = new Date(Date.now() - parseInt(olderThan) * 60 * 60 * 1000);
      whereClause.createdAt = { lt: hoursAgo };
    }

    const deletedItems = await prisma.monitorQueue.deleteMany({
      where: whereClause
    });

    return NextResponse.json({
      message: `${deletedItems.count} itens removidos da fila`,
      deletedCount: deletedItems.count,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Erro ao limpar fila:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}