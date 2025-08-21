export interface BetData {
  id: string;
  betId: string;
  chatId: number;
  userId: number | string; // Allow both number (for GeminiParser) and string (for database UUID)
  username?: string;
  message: string;
  data: Date;
  jogo: string;
  mercado: string;
  linha_da_aposta: string;
  odd_tipster: number;
  placar?: string;
  pegou?: boolean | null;
  odd_real?: number | null;
  resultado_aposta: string;
  stake?: number; // Novo: Stake
  groupName?: string; // Novo: Nome do grupo Telegram
}