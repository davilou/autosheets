import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage } from 'telegram/events';
import { GeminiParser } from '@/lib/gemini/parser';
import { BetData } from './parser';
import { SharedBetCache } from '@/lib/shared/bet-cache';
import input from 'input';

// CORREÇÃO: Interfaces mais simples e compatíveis
interface TelegramMessage {
  text?: string;
  photo?: any;
  senderId?: bigint;
  peerId?: any;
  replyTo?: {
    replyToMsgId: number;
  };
}

interface TelegramPeer {
  className: string;
  channelId?: bigint;
  chatId?: bigint;
  userId?: bigint;
  toString(): string;
}

interface GramJSConfig {
  apiId: number;
  apiHash: string;
  session: string;
  allowedChatIds: string[];
  yourUserId: string;
  botToken: string;
}

class GramJSMonitor {
  private client: TelegramClient;
  private allowedChatIds: Set<string>;
  private yourUserId: string;
  private botToken: string;
  private pendingBets = new Map<string, BetData>();

  constructor(config: GramJSConfig) {
    const stringSession = new StringSession(config.session);
    
    this.client = new TelegramClient(
      stringSession,
      config.apiId,
      config.apiHash,
      {
        connectionRetries: 10,
        retryDelay: 5000,
        timeout: 30000,
        autoReconnect: true,
        useWSS: true,
        testServers: false,
        floodSleepThreshold: 60,
      }
    );
    
    this.allowedChatIds = new Set(config.allowedChatIds);
    this.yourUserId = config.yourUserId;
    this.botToken = config.botToken;
  }

  async start() {
    console.log('🚀 Iniciando GramJS Monitor...');
    
    const startWithRetry = async (maxRetries = 5) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await this.client.start({
            phoneNumber: async () => process.env.TELEGRAM_PHONE_NUMBER!,
            password: async () => {
              const password = process.env.TELEGRAM_PASSWORD;
              if (password) return password;
              return await input.text('Digite sua senha 2FA (se habilitada): ');
            },
            phoneCode: async () => {
              return await input.text('Digite o código de verificação recebido no Telegram: ');
            },
            onError: (err: Error) => {
              console.error(`❌ Erro no cliente (tentativa ${attempt}):`, err);
              if (attempt < maxRetries) {
                console.log(`🔄 Tentando reconectar em 10 segundos...`);
              }
            },
          });
          
          console.log('✅ GramJS conectado! Configurando handlers...');
          await this.setupEventHandlers();
          console.log('👀 Monitorando grupos configurados...');
          
          this.setupConnectionMonitoring();
          return;
          
        } catch (error) {
          console.error(`❌ Falha na tentativa ${attempt}:`, error);
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 10000));
          } else {
            throw error;
          }
        }
      }
    };
    
    await startWithRetry();
  }

  private setupConnectionMonitoring() {
    setInterval(async () => {
      try {
        if (!this.client.connected) {
          console.log('🔄 Conexão perdida, tentando reconectar...');
          await this.client.connect();
        }
      } catch (error) {
        console.error('❌ Erro ao verificar conexão:', error);
      }
    }, 30000);
  }

  private async setupEventHandlers() {
    this.client.addEventHandler(async (event) => {
      const message = event.message as TelegramMessage;
      
      if (!message || !message.peerId) return;
      
      const chatId = this.getChatId(message.peerId as TelegramPeer);
      
      if (!this.allowedChatIds.has(chatId.toString()) && chatId.toString() !== this.yourUserId) {
        return;
      }

      // Definir as variáveis que estavam faltando
      const isAllowedGroup = this.allowedChatIds.has(chatId.toString());
      const isPrivateFromUser = chatId.toString() === this.yourUserId;

      if (isAllowedGroup) {
        console.log(`👀 Nova mensagem no grupo monitorado: ${chatId}`);
        
        if (message.text) {
          await this.processTextMessage(message, chatId);
        }
        
        if (message.photo) {
          await this.processPhotoMessage(message, chatId);
        }
      } else if (isPrivateFromUser) {
        console.log(`💬 Mensagem privada recebida: ${message.text}`);
        // Aqui você pode processar a resposta da odd
        await this.processPrivateMessage(message);
      }
    }, new NewMessage({}));
  }

  // CORREÇÃO: Usar any para evitar problemas de tipagem
  private async processTextMessage(message: TelegramMessage, chatId: string) {
    const messageText = message.text;
    const senderId = message.senderId?.toString() || '0';
    
    console.log(`📝 Analisando mensagem de texto: "${messageText}"`);

    try {
      if (!message.senderId) {
        console.log('❌ SenderId não encontrado na mensagem');
        return;
      }

      // CORREÇÃO: Converter bigint para number para compatibilidade com getEntity
      const sender: any = await this.client.getEntity(Number(message.senderId));
      const username = sender.username || sender.firstName || 'Usuário';

      const betData = await GeminiParser.parseBetMessage(
        messageText || '',
        parseInt(chatId),
        parseInt(senderId),
        username
      );

      if (betData) {
        console.log('🎯 Aposta detectada no grupo!');
        await this.sendPrivateNotification(betData);
      }
    } catch (error) {
      console.error('❌ Erro ao processar mensagem de texto:', error);
    }
  }

  private async processPhotoMessage(message: TelegramMessage, chatId: string) {
    const senderId = message.senderId?.toString() || '0';
    const caption = message.text || '';

    console.log('📸 Analisando imagem do grupo...');

    try {
      if (!message.senderId) {
        console.log('❌ SenderId não encontrado na mensagem');
        return;
      }

      // CORREÇÃO: Converter bigint para number para compatibilidade com getEntity
      const sender: any = await this.client.getEntity(Number(message.senderId));
      const username = sender.username || sender.firstName || 'Usuário';
      
      // CORREÇÃO: Usar any para downloadMedia
      const imageBuffer: any = await this.client.downloadMedia(message.photo, {
        progressCallback: (downloaded: any, total: any) => {
          const progress = Number(downloaded) / Number(total);
          console.log(`📥 Download: ${Math.round(progress * 100)}%`);
        }
      });
      
      if (imageBuffer && Buffer.isBuffer(imageBuffer)) {
        const imageBase64 = imageBuffer.toString('base64');
        const imageUrl = `data:image/jpeg;base64,${imageBase64}`;
        
        const betData = await GeminiParser.parseImageMessage(
          imageUrl,
          caption,
          parseInt(chatId),
          parseInt(senderId),
          username
        );

        if (betData) {
          console.log('🎯 Aposta detectada na imagem do grupo!');
          await this.sendPrivateNotification(betData);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao processar imagem:', error);
    }
  }

  private async sendPrivateNotification(betData: BetData) {
    const message = 
      `🎯 **Aposta detectada no grupo!**\n\n` +
      `⚽ **Jogo:** ${betData.jogo}\n` +
      `⚽ **Placar:** ${betData.placar || '0-0'}\n` +
      `📊 **Mercado:** ${betData.mercado}\n` +
      `📈 **Linha:** ${betData.linha_da_aposta}\n` +
      `💰 **Odd Tipster:** ${betData.odd_tipster}\n\n` +
      `💎 **Responda esta mensagem com a odd real que você conseguiu**\n` +
      `(Digite 0 se não conseguiu pegar a aposta)`;

    try {
      const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.yourUserId,
          text: message,
          parse_mode: 'Markdown'
        })
      });

      const result = await response.json();
      
      if (result.ok) {
        const botMessageId = result.result.message_id;
        // CORREÇÃO: Usar yourUserId ao invés de chat.id para consistência
        const betKey = `${this.yourUserId}_${botMessageId}`;
        
        this.pendingBets.set(betKey, betData);
        SharedBetCache.saveBet(betKey, betData);
        
        console.log(`📤 Notificação enviada. Aguardando resposta para: ${betKey}`);
        console.log(`💾 Aposta salva em ambos os caches: ${betKey}`);
        console.log(`🔍 DEBUG - Chat ID: ${result.result.chat.id}, Your User ID: ${this.yourUserId}`);
      } else {
        console.error('❌ Erro na API do Telegram:', result);
      }
    } catch (error) {
      console.error('❌ Erro ao enviar notificação:', error);
    }
  }

  public getPendingBet(betKey: string): BetData | undefined {
    return this.pendingBets.get(betKey);
  }

  // NOVO: Método para debug
  public getPendingBetsCount(): number {
    return this.pendingBets.size;
  }

  // NOVO: Método para listar todas as chaves
  public getPendingBetsKeys(): string[] {
    return Array.from(this.pendingBets.keys());
  }

  public removePendingBet(betKey: string): void {
    this.pendingBets.delete(betKey);
    SharedBetCache.removeBet(betKey);
    console.log(`🗑️ Aposta removida de ambos os caches: ${betKey}`);
  }

  public listPendingBets(): string[] {
    return Array.from(this.pendingBets.keys());
  }

  // CORREÇÃO: Tipar corretamente o parâmetro peerId
  private getChatId(peerId: TelegramPeer): string {
    if (peerId.className === 'PeerChannel') {
      return `-100${peerId.channelId}`;
    } else if (peerId.className === 'PeerChat') {
      return `-${peerId.chatId}`;
    } else if (peerId.className === 'PeerUser') {
      return peerId.userId?.toString() || '0';
    }
    
    return peerId.toString();
  }

  async getSessionString(): Promise<string> {
    // CORREÇÃO: Usar any para evitar problemas de tipagem
    return (this.client.session.save() as any);
  }

  private async processPrivateMessage(message: TelegramMessage) {
    // Debug: Log completo do objeto message para inspeção
    console.log('🔍 DEBUG - Objeto message completo:', JSON.stringify(message, null, 2));
    
    // Verificar se é uma resposta a uma mensagem do bot
    if (!message.replyTo) {
      console.log('📝 Mensagem privada não é uma resposta');
      return;
    }

    const repliedMessageId = message.replyTo.replyToMsgId;
    const betKey = `${this.yourUserId}_${repliedMessageId}`;
    
    console.log(`🔍 Procurando aposta para chave: ${betKey}`);
    console.log(`🔍 Chaves disponíveis no monitor:`, this.getPendingBetsKeys());
    
    const betData = this.getPendingBet(betKey);
    if (betData && message.text) {
      console.log(`💰 Processando resposta da odd: ${message.text}`);
      console.log(`📋 Dados da aposta encontrada:`, betData);
      
      // IMPORTANTE: Delegar para o webhook para manter consistência
      // O webhook tem toda a lógica de processamento e salvamento
      console.log('🔄 Delegando processamento para o webhook...');
      
      // Manter a aposta no cache para o webhook processar
      // Não remover aqui, deixar o webhook fazer isso
    } else {
      console.log('❌ Aposta não encontrada ou mensagem sem texto');
      console.log(`❌ Texto da mensagem: ${message.text}`);
      console.log(`❌ BetData encontrado: ${!!betData}`);
    }
  }

  private async handleOddResponse(oddText: string, betKey: string, betData: BetData) {
    // Implementar a mesma lógica do webhook aqui
    // Ou fazer uma chamada para o webhook com os dados
    console.log(`Processando odd: ${oddText} para aposta: ${betKey}`);
    
    // Remover da memória após processar
    this.removePendingBet(betKey);
  }

  async stop() {
    await this.client.disconnect();
    console.log('🔌 GramJS Monitor desconectado');
  }
}

export default GramJSMonitor;