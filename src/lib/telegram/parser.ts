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
  placar?: string; // NOVO: campo para o placar
  pegou?: boolean | null;
  odd_real?: number | null;
  resultado_aposta: string;
}

export class BetMessageParser {
  private static marketPatterns = {
    // Padrões para Asian Handicap
    asianHandicap: [
      /(?:hc|handicap)\s*([+-]?\d+[.,]?\d*)/i,
      /([+-]\d+[.,]?\d*)(?!.*(?:over|under|o|u))/i
    ],
    
    // Padrões para Goal Line
    goalLine: [
      /(?:over|o)\s*(\d+[.,]?\d*)/i,
      /(?:under|u)\s*(\d+[.,]?\d*)/i
    ]
  };

  private static oddPatterns = [
    /@(\d+[.,]?\d*)/,              // @1.72
    /odd\s+(\d+[.,]?\d*)/i,        // odd 1.75
    /(?:^|\s)(\d+[.,]?\d*)(?=\s|$)/ // 2.0 ou 1,75 isolado
  ];

  public static parseBetMessage(
    message: string, 
    chatId: number, 
    userId: number, 
    username?: string
  ): BetData | null {
    const cleanMessage = message.trim();
    
    // Extrair jogo (times/confronto)
    const jogo = this.extractGame(cleanMessage);
    
    // Extrair linha da aposta e determinar mercado
    const { linha_da_aposta, mercado } = this.extractMarketAndLine(cleanMessage);
    
    // Extrair odd do tipster
    const odd_tipster = this.extractOdd(cleanMessage);
    
    return {
      id: `${chatId}_${userId}_${Date.now()}`,
      chatId,
      userId,
      username,
      message: cleanMessage,
      data: new Date(),
      jogo,
      mercado,
      linha_da_aposta,
      odd_tipster,
      pegou: null,              // Mudança: usar null em vez de undefined
      odd_real: null,           // Mudança: usar null em vez de undefined
      resultado_aposta: 'Pendente'
    };
  }

  private static extractGame(message: string): string {
    // Remover padrões conhecidos para isolar o nome do jogo
    let cleanGame = message
      .replace(/@\d+[.,]?\d*/g, '')           // Remove odds
      .replace(/odd\s+\d+[.,]?\d*/gi, '')     // Remove "odd X.XX"
      .replace(/(?:hc|handicap)\s*[+-]?\d+[.,]?\d*/gi, '') // Remove handicap
      .replace(/(?:over|under|o|u)\s*\d+[.,]?\d*/gi, '')   // Remove over/under
      .replace(/[+-]\d+[.,]?\d*/g, '')        // Remove linhas isoladas
      .trim();
    
    // Se ainda contém "vs" ou "x", é um confronto
    if (cleanGame.match(/\s+(?:vs|x|vs\.|×)\s+/i)) {
      return cleanGame;
    }
    
    // Caso contrário, é um time único
    return cleanGame || 'Time não identificado';
  }

  private static extractMarketAndLine(message: string): {
    linha_da_aposta: string;
    mercado: string; // Mudança: aceitar qualquer string
  } {
    // Verificar Goal Line primeiro
    for (const pattern of this.marketPatterns.goalLine) {
      const match = message.match(pattern);
      if (match) {
        const value = match[1].replace(',', '.');
        const prefix = message.toLowerCase().includes('over') || message.toLowerCase().includes('o') ? 'o' : 'u';
        return {
          linha_da_aposta: `${prefix}${value}`,
          mercado: 'Goal Line'
        };
      }
    }
    
    // Verificar Asian Handicap
    for (const pattern of this.marketPatterns.asianHandicap) {
      const match = message.match(pattern);
      if (match) {
        const value = match[1].replace(',', '.');
        return {
          linha_da_aposta: value,
          mercado: 'Asian Handicap'
        };
      }
    }
    
    return {
      linha_da_aposta: 'Não identificado',
      mercado: 'Pendente'
    };
  }

  private static extractOdd(message: string): number {
    for (const pattern of this.oddPatterns) {
      const match = message.match(pattern);
      if (match) {
        const oddValue = match[1].replace(',', '.');
        const parsed = parseFloat(oddValue);
        if (!isNaN(parsed) && parsed >= 1.01 && parsed <= 50) {
          return parsed;
        }
      }
    }
    return 0; // Odd não encontrada
  }

  // Método para solicitar confirmação via Telegram
  public static createConfirmationMessage(betData: BetData): string {
      return `🎯 **Aposta Detectada**\n\n` +
             `📅 **Data:** ${betData.data.toLocaleString('pt-BR')}\n` +
             `⚽ **Jogo:** ${betData.jogo}\n` +
             `📊 **Placar:** ${betData.placar || 'Pré'}\n` +  // NOVO: mostrar placar
             `📊 **Mercado:** ${betData.mercado}\n` +
             `📈 **Linha:** ${betData.linha_da_aposta}\n` +
             `💰 **Odd Tipster:** ${betData.odd_tipster}\n\n` +
             `❓ **Você pegou esta aposta?**\n` +
             `Responda: SIM ou NÃO`;
    }
}