export interface BetData {
  id: string;
  chatId: number;
  userId: number;
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
}