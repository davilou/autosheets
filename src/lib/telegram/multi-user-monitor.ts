import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage } from 'telegram/events';
import { GeminiParser } from '@/lib/gemini/parser';
import { BetData } from './parser';
import { EventEmitter } from 'events';
import { decrypt } from '@/lib/security/encryption';
import { prisma } from '@/lib/db';
import { normalizeScore } from '@/lib/utils';

interface UserSession {
  userId: string;
  credentialId: string;
  client: TelegramClient;
  monitoredGroups: Set<string>;
  isActive: boolean;
  lastHeartbeat: Date;
  processedMessages: number;
  errorCount: number;
  sessionId: string;
}

interface MonitoredGroupConfig {
  id: string;
  chatId: string;
  chatTitle: string;
  isActive: boolean;
  keywords?: string[];
  excludeKeywords?: string[];
  allowedUsers?: string[];
  blockedUsers?: string[];
  minOdds?: number;
  maxOdds?: number;
  timeFilters?: {
    startTime: string;
    endTime: string;
    days: string[];
  };
}

interface QueueItem {
  id: string;
  userId: string;
  sessionId: string;
  messageData: any;
  priority: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'RETRYING';
  attempts: number;
  maxAttempts: number;
  scheduledFor?: Date;
  createdAt: Date;
  processedAt?: Date;
  errorMessage?: string;
}

class MultiUserTelegramMonitor extends EventEmitter {
  private userSessions: Map<string, UserSession> = new Map();
  private messageQueue: QueueItem[] = [];
  private isProcessingQueue = false;
  private heartbeatInterval?: NodeJS.Timeout;
  private queueProcessInterval?: NodeJS.Timeout;
  private performanceMetrics: Map<string, any> = new Map();

  constructor() {
    super();
    this.startHeartbeat();
    this.startQueueProcessor();
  }

  // Iniciar monitoramento para um usuário específico
  async startUserMonitoring(userId: string, credentialId: string): Promise<boolean> {
    try {
      console.log(`🚀 Iniciando monitoramento para usuário ${userId}`);

      // Verificar se já existe uma sessão ativa
      const existingSession = this.userSessions.get(`${userId}-${credentialId}`);
      if (existingSession && existingSession.isActive) {
        console.log(`⚠️ Sessão já ativa para usuário ${userId}`);
        return true;
      }

      // Buscar credencial e grupos monitorados
      const credential = await prisma.telegramCredential.findFirst({
        where: {
          id: credentialId,
          userId,
          isActive: true
        },
        include: {
          sessions: {
            where: { isActive: true },
            orderBy: { lastUsed: 'desc' },
            take: 1
          },
          monitoredGroups: {
            where: { isActive: true }
          }
        }
      });

      if (!credential || !credential.sessions.length) {
        throw new Error('Credencial ou sessão não encontrada');
      }

      // Descriptografar dados da sessão e credenciais
      const sessionData = decrypt(credential.sessions[0].sessionData, userId);
      const apiId = decrypt(credential.apiId, userId);
      const apiHash = decrypt(credential.apiHash, userId);
      
      if (!sessionData || typeof sessionData !== 'string') {
        throw new Error(`Dados da sessão inválidos: tipo=${typeof sessionData}, valor=${sessionData}`);
      }
      
      // A sessionData é um JSON, precisamos extrair o sessionString
      let actualSessionString: string;
      try {
        const sessionObj = JSON.parse(sessionData);
        actualSessionString = sessionObj.sessionString || '';
      } catch (error) {
        console.error('❌ Erro ao fazer parse da sessionData:', error);
        actualSessionString = sessionData; // fallback para string direta
      }
      
      console.log('🔍 actualSessionString tipo:', typeof actualSessionString);
      console.log('🔍 actualSessionString comprimento:', actualSessionString?.length || 0);
      console.log('🔍 actualSessionString amostra:', actualSessionString?.substring(0, 50) || 'vazio');
      
      if (!actualSessionString || typeof actualSessionString !== 'string') {
        throw new Error(`SessionString inválida: tipo=${typeof actualSessionString}, valor=${actualSessionString}`);
      }
      
      // Criar cliente Telegram com configurações otimizadas
      const client = new TelegramClient(
        new StringSession(actualSessionString),
        parseInt(apiId),
        apiHash,
        {
          connectionRetries: 5,
          requestRetries: 3,
          retryDelay: 1000,
          autoReconnect: true,
          floodSleepThreshold: 60,
          useWSS: false,
          timeout: 10
        }
      );

      // Conectar cliente
      await client.connect();

      // Criar sessão de usuário
      const sessionId = `${userId}-${credentialId}-${Date.now()}`;
      const userSession: UserSession = {
        userId,
        credentialId,
        client,
        monitoredGroups: new Set(credential.monitoredGroups.map(g => g.chatId)),
        isActive: true,
        lastHeartbeat: new Date(),
        processedMessages: 0,
        errorCount: 0,
        sessionId
      };

      // Configurar event handlers
      await this.setupEventHandlers(userSession, credential.monitoredGroups);

      // Salvar sessão
      this.userSessions.set(`${userId}-${credentialId}`, userSession);

      // Registrar sessão no banco
      await prisma.userMonitorSession.upsert({
        where: {
          userId_credentialId: {
            userId,
            credentialId
          }
        },
        update: {
          sessionId,
          isActive: true,
          lastHeartbeat: new Date(),
          errorCount: 0
        },
        create: {
          userId,
          credentialId,
          sessionId,
          isActive: true
        }
      });

      console.log(`✅ Monitoramento iniciado para usuário ${userId}`);
      this.emit('userSessionStarted', { userId, credentialId, sessionId });
      
      return true;
    } catch (error) {
      console.error(`❌ Erro ao iniciar monitoramento para usuário ${userId}:`, error);
      this.emit('userSessionError', { userId, credentialId, error });
      return false;
    }
  }

  // Parar monitoramento para um usuário específico
  async stopUserMonitoring(userId: string, credentialId: string): Promise<boolean> {
    try {
      const sessionKey = `${userId}-${credentialId}`;
      const userSession = this.userSessions.get(sessionKey);

      if (!userSession) {
        console.log(`⚠️ Sessão não encontrada para usuário ${userId}`);
        return true;
      }

      // Desconectar cliente
      if (userSession.client) {
        await userSession.client.disconnect();
      }

      // Remover sessão
      this.userSessions.delete(sessionKey);

      // Atualizar banco
      await prisma.userMonitorSession.updateMany({
        where: {
          userId,
          credentialId
        },
        data: {
          isActive: false
        }
      });

      console.log(`🛑 Monitoramento parado para usuário ${userId}`);
      this.emit('userSessionStopped', { userId, credentialId });
      
      return true;
    } catch (error) {
      console.error(`❌ Erro ao parar monitoramento para usuário ${userId}:`, error);
      return false;
    }
  }

  // Configurar event handlers para uma sessão de usuário
  private async setupEventHandlers(userSession: UserSession, monitoredGroups: any[]) {
    const groupConfigs = new Map<string, MonitoredGroupConfig>();
    
    // Processar configurações dos grupos
    for (const group of monitoredGroups) {
      groupConfigs.set(group.chatId, {
        id: group.id,
        chatId: group.chatId,
        chatTitle: group.chatTitle,
        isActive: group.isActive,
        keywords: group.keywords ? JSON.parse(group.keywords) : undefined,
        excludeKeywords: group.excludeKeywords ? JSON.parse(group.excludeKeywords) : undefined,
        allowedUsers: group.allowedUsers ? JSON.parse(group.allowedUsers) : undefined,
        blockedUsers: group.blockedUsers ? JSON.parse(group.blockedUsers) : undefined,
        minOdds: group.minOdds,
        maxOdds: group.maxOdds,
        timeFilters: group.timeFilters ? JSON.parse(group.timeFilters) : undefined,
      });
    }

    userSession.client.addEventHandler(async (event) => {
      try {
        const message = event.message as any;
        
        if (!message || !message.peerId) return;

        const chatId = this.getChatId(message.peerId);
        const groupConfig = groupConfigs.get(chatId);

        // Verificar se é um grupo monitorado
        if (!groupConfig || !groupConfig.isActive) return;

        // Aplicar filtros
        if (!this.shouldProcessMessage(message, groupConfig)) return;

        // Pré-parse: somente enfileira se for aposta
        const senderId = message.senderId?.toString() || '0';
        let betData = null as BetData | null;
        if (message.text) {
          betData = await GeminiParser.parseBetMessage(
            message.text,
            parseInt(chatId),
            parseInt(senderId || '0'),
            'Usuário'
          );
        }
        // Se não conseguiu via texto e houver foto, tenta analisar a imagem
        if (!betData && message.photo) {
          try {
            const downloaded = await this.downloadPhotoBuffer(userSession.client, message);
            if (downloaded?.buffer) {
              betData = await GeminiParser.parseImageMessage(
                null,
                message.text || '',
                parseInt(chatId),
                parseInt(senderId || '0'),
                'Usuário',
                { imageBuffer: downloaded.buffer, mimeType: downloaded.mimeType || 'image/jpeg' }
              );
            }
          } catch (err) {
            console.error('Erro ao baixar/analisar imagem na pré-fila:', err);
          }
        }
        
        if (!betData) {
          // Não é aposta -> NÃO adicionar à fila
          return;
        }

        // Anexar nome do grupo ao betData para salvar na planilha
        if (groupConfig?.chatTitle) {
          (betData as any).groupName = groupConfig.chatTitle;
        }

        // Adicionar à fila de processamento APENAS com dados de aposta
        await this.addToQueue({
          userId: userSession.userId,
          sessionId: userSession.sessionId,
          messageData: {
            text: message.text,
            photo: message.photo,
            senderId: senderId,
            chatId,
            messageId: message.id,
            groupConfig,
            betData,
            betId: betData.betId,
          },
          priority: this.calculatePriority(message, groupConfig)
        });

        userSession.processedMessages++;
        userSession.lastHeartbeat = new Date();
        
      } catch (error) {
        console.error(`❌ Erro no handler de evento para usuário ${userSession.userId}:`, error);
        userSession.errorCount++;
        this.emit('messageProcessingError', { 
          userId: userSession.userId, 
          error,
          sessionId: userSession.sessionId 
        });
      }
    }, new NewMessage({}));
  }

  // Verificar se a mensagem deve ser processada com base nos filtros
  private shouldProcessMessage(message: any, groupConfig: MonitoredGroupConfig): boolean {
    const messageText = message.text?.toLowerCase() || '';
    const senderId = message.senderId?.toString();

    // Filtro de usuários bloqueados
    if (groupConfig.blockedUsers?.includes(senderId)) {
      return false;
    }

    // Filtro de usuários permitidos (se definido)
    if (groupConfig.allowedUsers?.length && !groupConfig.allowedUsers.includes(senderId)) {
      return false;
    }

    // Filtro de palavras para excluir
    if (groupConfig.excludeKeywords?.some(keyword => 
      messageText.includes(keyword.toLowerCase())
    )) {
      return false;
    }

    // Filtro de palavras-chave (se definido)
    if (groupConfig.keywords?.length && !groupConfig.keywords.some(keyword => 
      messageText.includes(keyword.toLowerCase())
    )) {
      return false;
    }

    // Filtro de horário
    if (groupConfig.timeFilters) {
      const now = new Date();
      const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const currentTime = now.toTimeString().slice(0, 5);

      if (!groupConfig.timeFilters.days.includes(currentDay) ||
          currentTime < groupConfig.timeFilters.startTime ||
          currentTime > groupConfig.timeFilters.endTime) {
        return false;
      }
    }

    return true;
  }

  // Calcular prioridade da mensagem
  private calculatePriority(message: any, groupConfig: MonitoredGroupConfig): number {
    let priority = 1; // Prioridade baixa por padrão

    // Prioridade alta para mensagens com foto
    if (message.photo) priority = 3;

    // Prioridade média para mensagens com palavras-chave específicas
    const highPriorityKeywords = ['odd', 'aposta', 'tip', 'green'];
    const messageText = message.text?.toLowerCase() || '';
    
    if (highPriorityKeywords.some(keyword => messageText.includes(keyword))) {
      priority = Math.max(priority, 2);
    }

    return priority;
  }

  // Adicionar item à fila de processamento
  private async addToQueue(item: Omit<QueueItem, 'id' | 'status' | 'attempts' | 'maxAttempts' | 'createdAt'>) {
    // Segurança extra: não enfileirar nem persistir mensagens sem betData
    if (!item?.messageData?.betData) {
      return;
    }

    const queueItem: QueueItem = {
      id: `${item.userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...item,
      status: 'PENDING',
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date()
    };

    this.messageQueue.push(queueItem);
    
    // Salvar no banco
    await prisma.monitorQueue.create({
      data: {
        id: queueItem.id,
        userId: queueItem.userId,
        sessionId: queueItem.sessionId,
        messageData: JSON.stringify(queueItem.messageData),
        priority: queueItem.priority,
        status: queueItem.status,
        attempts: queueItem.attempts,
        maxAttempts: queueItem.maxAttempts,
        createdAt: queueItem.createdAt,
        betId: queueItem.messageData.betId || null,
        // Incluir dados básicos se disponíveis no messageData
        chatId: queueItem.messageData.chatId ? BigInt(queueItem.messageData.chatId) : null,
        messageId: queueItem.messageData.messageId ? BigInt(queueItem.messageData.messageId) : null
      }
    });

    // Ordenar fila por prioridade
    this.messageQueue.sort((a, b) => b.priority - a.priority);
  }

  // Processar fila de mensagens
  private async processQueue() {
    if (this.isProcessingQueue || this.messageQueue.length === 0) return;

    this.isProcessingQueue = true;

    try {
      const item = this.messageQueue.shift();
      if (!item) return;

      // Atualizar status
      item.status = 'PROCESSING';
      await this.updateQueueItem(item);

      try {
        // Processar mensagem
        await this.processMessage(item);
        
        // Marcar como concluído
        item.status = 'COMPLETED';
        item.processedAt = new Date();
        await this.updateQueueItem(item);
        
      } catch (error) {
        console.error(`❌ Erro ao processar item da fila ${item.id}:`, error);
        
        item.attempts++;
        item.errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        
        if (item.attempts >= item.maxAttempts) {
          item.status = 'FAILED';
        } else {
          item.status = 'RETRYING';
          item.scheduledFor = new Date(Date.now() + (item.attempts * 30000)); // Retry com backoff
          this.messageQueue.push(item); // Recolocar na fila
        }
        
        await this.updateQueueItem(item);
      }
      
    } finally {
      this.isProcessingQueue = false;
    }
  }

  // Processar uma mensagem específica
  private async processMessage(queueItem: QueueItem) {
    const { messageData } = queueItem;
    const { text, photo, senderId, chatId, groupConfig } = messageData;

    try {
      // Reutilizar betData pré-calculado se disponível
      let betData: BetData | null = messageData.betData || null;

      if (!betData) {
        if (text) {
          // Processar mensagem de texto
          betData = await GeminiParser.parseBetMessage(
            text,
            parseInt(chatId),
            parseInt(senderId || '0'),
            'Usuário' // TODO: Buscar nome do usuário
          );
        }
        // Se não conseguiu via texto e houver foto, tenta analisar a imagem
        if (!betData && photo) {
          try {
            // Tentar baixar novamente a imagem caso não tenhamos buffer
            const sessionKey = Array.from(this.userSessions.keys()).find(k => k.startsWith(queueItem.userId));
            const session = sessionKey ? this.userSessions.get(sessionKey) : undefined;
            if (session) {
              const downloaded = await this.downloadPhotoBuffer(session.client, { photo, id: messageData.messageId, text: messageData.text });
              if (downloaded?.buffer) {
                betData = await GeminiParser.parseImageMessage(
                  null,
                  text || '',
                  parseInt(chatId),
                  parseInt(senderId || '0'),
                  'Usuário',
                  { imageBuffer: downloaded.buffer, mimeType: downloaded.mimeType || 'image/jpeg' }
                );
              }
            }
          } catch (err) {
            console.error('Erro ao baixar/analisar imagem no processamento da fila:', err);
          }
        }
      }

      if (betData) {
        // Garantir nome do grupo no betData
        if (groupConfig?.chatTitle) {
          (betData as any).groupName = groupConfig.chatTitle;
        }

        // Aplicar filtros de odds
        if (groupConfig.minOdds && betData.odd_tipster < groupConfig.minOdds) return;
        if (groupConfig.maxOdds && betData.odd_tipster > groupConfig.maxOdds) return;

        // Salvar aposta no banco
        await prisma.bet.create({
          data: {
            userId: queueItem.userId,
            betId: betData.betId,
            jogo: betData.jogo,
            placar: normalizeScore(betData.placar || '0-0'),
            mercado: betData.mercado,
            linhaDaAposta: betData.linha_da_aposta,
            oddTipster: betData.odd_tipster,
            chatId: parseInt(chatId),
            messageId: queueItem.messageData?.messageId ? parseInt(queueItem.messageData.messageId) : 0,
          }
        });

        // NOVO FLUXO: Salvar imediatamente na planilha do usuário
        try {
          const GoogleSheetsService = (await import('@/lib/sheets/service')).default;
          const SpreadsheetManager = (await import('@/lib/spreadsheets/manager')).default;
          
          const spreadsheetManager = new SpreadsheetManager();
          
          // Buscar a planilha ativa do usuário
          const userSpreadsheetId = await spreadsheetManager.getUserActiveSpreadsheet(queueItem.userId);
          
          if (userSpreadsheetId) {
            const sheetsConfig = {
              spreadsheetId: userSpreadsheetId,
              range: 'Dados!A:M',
              credentials: {
                client_email: process.env.GOOGLE_CLIENT_EMAIL!,
                private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
              },
            };
            
            const sheetsService = new GoogleSheetsService(sheetsConfig);
            
            // Configurar betData para salvar na planilha com odd_real em branco
            betData.userId = queueItem.userId;
            betData.pegou = null; // Deixar em branco até o usuário responder
            betData.odd_real = null; // Deixar em branco até o usuário responder
            
            // Salvar dados iniciais (sem odd_real)
            const success = await sheetsService.addBetData(betData);
            
            if (success) {
              console.log('✅ Aposta salva na planilha do usuário com dados iniciais');
            } else {
              console.error('❌ Erro ao salvar aposta inicial na planilha do usuário');
            }
          } else {
            console.error('❌ Usuário não possui planilha ativa:', queueItem.userId);
          }
        } catch (error) {
          console.error('❌ Erro ao salvar na planilha do usuário:', error);
        }

        // Atualizar o item da MonitorQueue com status PENDING (aguardando odd real)
        await prisma.monitorQueue.update({
          where: { id: queueItem.id },
          data: {
            jogo: betData.jogo,
            placar: betData.placar ? normalizeScore(betData.placar) : '0-0',
            mercado: betData.mercado,
            linhaDaAposta: betData.linha_da_aposta,
            oddTipster: betData.odd_tipster,
            chatId: BigInt(chatId),
            messageId: queueItem.messageData?.messageId ? BigInt(queueItem.messageData.messageId) : null,
            status: 'PENDING', // Aguardando odd real do usuário
            processedAt: new Date(),
            betId: betData.betId
          }
        });

        // Atualizar estatísticas do grupo
        await prisma.monitoredGroup.update({
          where: { id: groupConfig.id },
          data: {
            betCount: { increment: 1 },
            lastActivity: new Date()
          }
        });

        this.emit('betDetected', {
          userId: queueItem.userId,
          betData,
          groupConfig
        });
      }

      // Atualizar estatísticas do grupo
      await prisma.monitoredGroup.update({
        where: { id: groupConfig.id },
        data: {
          messageCount: { increment: 1 },
          lastActivity: new Date()
        }
      });
      
    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
      throw error;
    }
  }

  // Atualizar item da fila no banco
  private async updateQueueItem(item: QueueItem) {
    await prisma.monitorQueue.update({
      where: { id: item.id },
      data: {
        status: item.status,
        attempts: item.attempts,
        scheduledFor: item.scheduledFor,
        processedAt: item.processedAt,
        errorMessage: item.errorMessage
      }
    });
  }

  // Iniciar heartbeat para monitorar sessões
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(async () => {
      for (const [key, session] of this.userSessions) {
        try {
          // Atualizar heartbeat local e no banco
          const now = new Date();
          session.lastHeartbeat = now;
          
          await prisma.userMonitorSession.updateMany({
            where: {
              userId: session.userId,
              credentialId: session.credentialId,
              isActive: true
            },
            data: {
              lastHeartbeat: now,
              processedMessages: session.processedMessages,
              errorCount: session.errorCount
            }
          });

          // Verificar se a sessão está saudável
          const timeSinceLastHeartbeat = Date.now() - session.lastHeartbeat.getTime();
          if (timeSinceLastHeartbeat > 300000) { // 5 minutos
            console.warn(`⚠️ Sessão ${key} sem heartbeat há ${timeSinceLastHeartbeat}ms`);
            this.emit('sessionUnhealthy', { sessionKey: key, session });
          }
          
        } catch (error) {
          console.error(`❌ Erro no heartbeat para sessão ${key}:`, error);
        }
      }
    }, 60000); // A cada minuto
  }

  // Iniciar processador de fila
  private startQueueProcessor() {
    this.queueProcessInterval = setInterval(() => {
      this.processQueue();
    }, 5000); // A cada 5 segundos
  }

  // Obter ID do chat
  private getChatId(peerId: any): string {
    if (peerId.className === 'PeerChannel') {
      return `-100${peerId.channelId}`;
    } else if (peerId.className === 'PeerChat') {
      return `-${peerId.chatId}`;
    } else if (peerId.className === 'PeerUser') {
      return peerId.userId?.toString() || '0';
    }
    return peerId.toString();
  }

  // Baixar foto de mensagem do Telegram como Buffer
  private async downloadPhotoBuffer(client: TelegramClient, message: any): Promise<{ buffer: Buffer; mimeType?: string } | null> {
    try {
      // Tenta usar a API de alto nível do cliente para baixar a mídia
      const maybeBuffer = await (client as any).downloadMedia(message);
      if (maybeBuffer && Buffer.isBuffer(maybeBuffer)) {
        return { buffer: maybeBuffer, mimeType: 'image/jpeg' };
      }

      // Fallback: se a mídia estiver diretamente no campo photo
      if (message?.photo) {
        const maybeBuffer2 = await (client as any).downloadMedia({ media: message.photo });
        if (maybeBuffer2 && Buffer.isBuffer(maybeBuffer2)) {
          return { buffer: maybeBuffer2, mimeType: 'image/jpeg' };
        }
      }

      console.warn('downloadPhotoBuffer: não foi possível obter Buffer da imagem');
      return null;
    } catch (err) {
      console.error('downloadPhotoBuffer error:', err);
      return null;
    }
  }

  // Obter estatísticas de performance
  getPerformanceMetrics(userId?: string) {
    const metrics: any = {
      totalSessions: this.userSessions.size,
      queueSize: this.messageQueue.length,
      timestamp: new Date()
    };

    if (userId) {
      const userSessions = Array.from(this.userSessions.values())
        .filter(session => session.userId === userId);
      
      metrics.userSessions = userSessions.length;
      metrics.userProcessedMessages = userSessions.reduce((sum, s) => sum + s.processedMessages, 0);
      metrics.userErrors = userSessions.reduce((sum, s) => sum + s.errorCount, 0);
    }

    return metrics;
  }

  // Limpar recursos
  async cleanup() {
    console.log('🧹 Limpando recursos do monitor...');
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.queueProcessInterval) {
      clearInterval(this.queueProcessInterval);
    }

    // Desconectar todas as sessões
    for (const [key, session] of this.userSessions) {
      try {
        await session.client.disconnect();
      } catch (error) {
        console.error(`Erro ao desconectar sessão ${key}:`, error);
      }
    }

    this.userSessions.clear();
  }
}

export default MultiUserTelegramMonitor;