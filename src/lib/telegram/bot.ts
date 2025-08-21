import { Telegraf, Context } from 'telegraf';
import { TELEGRAM_CONFIG } from '../security/config';

interface BetData {
  id: string;
  chatId: number;
  userId: number;
  username?: string;
  message: string;
  timestamp: Date;
  betType?: string;
  amount?: number;
  odds?: number;
}

class TelegramBotService {
  private bot: Telegraf;
  private isListening = false;

  constructor(token: string) {
    this.bot = new Telegraf(token);
    this.setupMiddleware();
    this.setupHandlers();
  }

  private setupMiddleware() {
    // Rate limiting middleware
    this.bot.use(async (ctx, next) => {
      // Implementar rate limiting por chat
      return next();
    });

    // Security middleware
    this.bot.use(async (ctx, next) => {
      if (!this.isAllowedChatType(ctx)) {
        return;
      }
      return next();
    });
  }

  private setupHandlers() {
    // Handler para mensagens de apostas
    this.bot.on('text', async (ctx) => {
      try {
        const betData = this.parseBetMessage(ctx);
        if (betData) {
          await this.processBetData(betData);
        }
      } catch (error) {
        console.error('Erro ao processar mensagem:', error);
      }
    });
  }

  private isAllowedChatType(ctx: Context): boolean {
    const chatType = ctx.chat?.type;
    return TELEGRAM_CONFIG.ALLOWED_CHAT_TYPES.includes(chatType || '');
  }

  private parseBetMessage(ctx: Context): BetData | null {
    if (!ctx.message || !('text' in ctx.message)) return null;
    if (!ctx.chat || !ctx.from) return null;

    const message = ctx.message.text;
    const chatId = ctx.chat.id;
    const userId = ctx.from.id;
    const username = ctx.from.username;

    // Regex patterns para diferentes tipos de apostas
    const patterns = {
      simple: /aposta\s+(\d+(?:\.\d{2})?)\s+em\s+(.+)\s+@(\d+\.\d+)/i,
      multiple: /múltipla\s+(\d+(?:\.\d{2})?)\s+(.+)/i,
      // Adicionar mais patterns conforme necessário
    };

    let betType: string | undefined;
    let amount: number | undefined;
    let odds: number | undefined;

    // Tentar fazer match com os patterns
    for (const [type, pattern] of Object.entries(patterns)) {
      const match = message.match(pattern);
      if (match) {
        betType = type;
        amount = parseFloat(match[1]);
        if (match[3]) odds = parseFloat(match[3]);
        break;
      }
    }

    return {
      id: `${chatId}_${userId}_${Date.now()}`,
      chatId,
      userId,
      username,
      message,
      timestamp: new Date(),
      betType,
      amount,
      odds,
    };
  }

  private async processBetData(betData: BetData) {
    // Aqui será implementada a lógica para enviar para Google Sheets
    console.log(`Dados da aposta processados: id=${betData.id}, chatId=${betData.chatId}, userId=${betData.userId}, betType=${betData.betType ?? 'N/A'}, amount=${betData.amount ?? 'N/A'}, odds=${betData.odds ?? 'N/A'}`);
    
    // TODO: Integrar com Google Sheets API
    // TODO: Salvar em cache/database temporário
    // TODO: Implementar retry logic
  }

  public startListening() {
    if (!this.isListening) {
      this.bot.launch();
      this.isListening = true;
      console.log('Bot do Telegram iniciado');
    }
  }

  public stopListening() {
    if (this.isListening) {
      this.bot.stop();
      this.isListening = false;
      console.log('Bot do Telegram parado');
    }
  }
}

export default TelegramBotService;
export type { BetData };