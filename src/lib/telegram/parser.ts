import { normalizeScore, formatOddBrazilian } from '@/lib/utils';

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
  placar?: string; // NOVO: campo para o placar
  pegou?: boolean | null;
  odd_real?: number | null;
  resultado_aposta: string;
  stake?: number; // NOVO: Stake (stake)
  sheetRowSaved?: boolean; // NOVO: indica se a aposta já foi salva na planilha
  groupName?: string; // Novo: Nome do grupo Telegram
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
    ],
    
    // Padrões para Resultado Final (1x2)
    resultadoFinal: [
      /\b(?:resultado|1x2|moneyline|match\s*result)\b/i,
      /\b([12x])\b(?:\s|$)/i, // Captura 1, 2 ou X isolados
      /\b(?:casa|home|mandante)\b/i, // Vitória da casa
      /\b(?:empate|draw|tie)\b/i,    // Empate
      /\b(?:fora|away|visitante)\b/i // Vitória do visitante
    ]
  };

  // Detectar aposta múltipla / parlay / betbuilder
  private static isMultiBetText(text?: string): boolean {
    if (!text) return false;
    const t = text.toLowerCase();
    return /(m[úu]ltipla|Múltipla|\bmulti\b|parlay|bet\s*builder|betbuilder|combinad[ao]|\bdupla\b|\btripla\b|acca)/i.test(t);
  }

  // Helper para normalizar mercado e linha_da_aposta para padronização
  private static normalizeBetData(mercado: string, linha_da_aposta: string): { mercado: string; linha_da_aposta: string } {
    let m = (mercado || '').trim();
    let l = (linha_da_aposta || '').trim();

    const lower = m.toLowerCase();

    if (/(asian|asiático|asiatico|\bah\b|\bhc\b)/i.test(lower)) {
      m = 'Asian Handicap';
      // Preservar precisão do valor
      const matchAH = l.match(/AH\s*([+\-]?\d+(?:[\.,]\d+)?)/i);
      if (matchAH) {
        const raw = matchAH[1].replace(',', '.');
        const sign = raw.startsWith('-') ? '-' : '+';
        const absVal = raw.replace(/^[+\-]/, '');
        l = `AH${sign}${absVal}`;
      } else {
        const matchNum = l.match(/([+\-]?\d+(?:[\.,]\d+)?)/);
        if (matchNum) {
          const raw = matchNum[1].replace(',', '.');
          const sign = raw.startsWith('-') ? '-' : '+';
          const absVal = raw.replace(/^[+\-]/, '');
          l = `AH${sign}${absVal}`;
        }
      }
    } else if (/(goal|gol|gols|over|under)/i.test(lower)) {
      m = 'Goal Line';
      const matchOU = l.match(/(o|u|over|under)\s*([+\-]?\d+(?:[\.,]\d+)?)/i);
      if (matchOU) {
        const type = matchOU[1].toLowerCase();
        const value = matchOU[2].replace(',', '.');
        const prefix = (type === 'o' || type === 'over') ? 'Over' : 'Under';
        l = `${prefix} ${value}`;
      } else {
        const onlyNum = l.match(/([+\-]?\d+(?:[\.,]\d+)?)/);
        if (onlyNum) {
          const value = onlyNum[1].replace(',', '.');
          l = `Over ${value}`;
        }
      }
    } else if (/(resultado|1x2)/i.test(lower)) {
      m = 'Resultado Final';
      // l já deve conter '1', 'X' ou '2' extraído em extractMarketAndLine
    }

    return { mercado: m, linha_da_aposta: l };
  }

  private static oddPatterns = [
    /@(\d+[.,]?\d*)/,              // @1.72
    /odd\s+(\d+[.,]?\d*)/i,        // odd 1.75
    /(?:^|\s)(\d+[.,]?\d*)(?=\s|$)/ // 2.0 ou 1,75 isolado
  ];

  // Extrai stake a partir do texto: "1u", "0,5u", "stake 2", "2 unidades", "meia unidade"
  private static extractStake(message: string): number | undefined {
    const text = message.toLowerCase();

    // "meia unidade" => 0.5
    if (/\bmeia\s+unidade\b/.test(text)) return 0.5;

    // "stake: 1.5" ou "stake 1,5"
    const mStakeWord = text.match(/stake\s*[:=]?\s*(\d+[.,]?\d*)/i);
    if (mStakeWord) {
      const n = parseFloat(mStakeWord[1].replace(',', '.'));
      if (Number.isFinite(n) && n >= 0) return n;
    }

    // "2u" ou "0,5u"
    const mUnits = text.match(/\b(\d+[.,]?\d*)\s*u\b/i);
    if (mUnits) {
      const n = parseFloat(mUnits[1].replace(',', '.'));
      if (Number.isFinite(n) && n >= 0) return n;
    }

    // "2 unidades" ou "1 unidade"
    const mUnidades = text.match(/\b(\d+[.,]?\d*)\s*unidades?\b/i);
    if (mUnidades) {
      const n = parseFloat(mUnidades[1].replace(',', '.'));
      if (Number.isFinite(n) && n >= 0) return n;
    }

    return undefined;
  }

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

    // Extrair stake
    const stake = this.extractStake(cleanMessage) ?? 1; // padrão: 1 unidade
    
    const timestamp = Date.now();
    const betId = `BET${timestamp.toString().slice(-8)}_${chatId.toString().slice(-4)}_${userId.toString().slice(-4)}`;
    
    return {
      id: `${chatId}_${userId}_${timestamp}`,
      betId,
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
      resultado_aposta: 'Pendente',
      stake
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
    // Múltipla / Betbuilder
    if (this.isMultiBetText(message)) {
      return {
        linha_da_aposta: 'Múltipla',
        mercado: 'Múltipla'
      };
    }

    // Verificar Resultado Final (1x2)
    const msgLower = message.toLowerCase();
    if (this.marketPatterns.resultadoFinal.some(p => p.test(message))) {
      let sign: '1' | 'X' | '2' | null = null;

      // Prefer explicit 1/2/X token
      const mToken = message.match(/\b([12x])\b/i);
      if (mToken) {
        sign = mToken[1].toUpperCase() as '1' | 'X' | '2';
      } else if (/(?:\bcasa\b|\bhome\b|\bmandante\b)/i.test(message)) {
        sign = '1';
      } else if (/(?:\bempate\b|\bdraw\b|\btie\b)/i.test(message)) {
        sign = 'X';
      } else if (/(?:\bfora\b|\baway\b|\bvisitante\b)/i.test(message)) {
        sign = '2';
      }

      const mercado = 'Resultado Final';
      const linha_da_aposta = sign ?? 'Não identificado';
      return this.normalizeBetData(mercado, linha_da_aposta);
    }

    // Verificar Goal Line primeiro
    for (const pattern of this.marketPatterns.goalLine) {
      const match = message.match(pattern);
      if (match) {
        const value = match[1].replace(',', '.');
        const prefix = message.toLowerCase().includes('over') || message.toLowerCase().includes('o') ? 'Over' : 'Under';
        const mercado = 'Goal Line';
        const linha_da_aposta = `${prefix} ${value}`;
        
        return this.normalizeBetData(mercado, linha_da_aposta);
      }
    }
    
    // Verificar Asian Handicap
    for (const pattern of this.marketPatterns.asianHandicap) {
      const match = message.match(pattern);
      if (match) {
        const value = match[1].replace(',', '.');
        const mercado = 'Asian Handicap';
        const linha_da_aposta = value;
        
        return this.normalizeBetData(mercado, linha_da_aposta);
      }
    }
    
    return {
      linha_da_aposta: 'Não identificado',
      mercado: 'Pendente'
    };
  }

  private static extractOdd(message: string): number {
    // Remover trechos de stake para evitar confusão com odd
    let text = message.replace(/stake\s*[:=]?\s*\d+[.,]?\d*/gi, '')
                      .replace(/\b\d+[.,]?\d*\s*u\b/gi, '')
                      .replace(/\b\d+[.,]?\d*\s*unidades?\b/gi, '');

    for (const pattern of this.oddPatterns) {
      const match = text.match(pattern);
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
             `📊 **Placar:** ${betData.placar ? normalizeScore(betData.placar) : 'Pré'}\n` +
             `📊 **Mercado:** ${betData.mercado}\n` +
             `📈 **Linha:** ${betData.linha_da_aposta}\n` +
             `💰 **Odd Tipster:** ${formatOddBrazilian(betData.odd_tipster)}` +
             `${betData.stake !== undefined ? `\n🎯 **Stake:** ${betData.stake}` : ''}` +
             `\n\n❓ **Você pegou esta aposta?**\n` +
             `Responda: SIM ou NÃO`;
    }
}