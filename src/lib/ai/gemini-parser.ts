import { BetData } from '../telegram/parser';
import { normalizeScore, formatOddBrazilian } from '../utils';

interface GeminiResponse {
  candidates: {
    content: {
      parts: {
        text: string;
      }[];
    };
  }[];
}

export class GeminiParser {
  private static readonly API_KEY = process.env.GEMINI_API_KEY;
  private static readonly API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';

  // Helper: detect multi/parlay/betbuilder bets in text
  private static isMultiBetText(text?: string): boolean {
    if (!text) return false;
    const t = text.toLowerCase();
    return /(m[úu]ltipla|Múltipla|\bmulti\b|parlay|bet\s*builder|betbuilder|combinad[ao]|\bdupla\b|\btripla\b|acca)/i.test(t);
  }

  // Extrai stake a partir do texto
  private static extractStake(message: string): number | undefined {
    const text = message.toLowerCase();

    if (/\bmeia\s+unidade\b/.test(text)) return 0.5;

    const mStakeWord = text.match(/stake\s*[:=]?\s*(\d+[.,]?\d*)/i);
    if (mStakeWord) {
      const n = parseFloat(mStakeWord[1].replace(',', '.'));
      if (Number.isFinite(n) && n >= 0) return n;
    }

    const mUnits = text.match(/\b(\d+[.,]?\d*)\s*u\b/i);
    if (mUnits) {
      const n = parseFloat(mUnits[1].replace(',', '.'));
      if (Number.isFinite(n) && n >= 0) return n;
    }

    const mUnidades = text.match(/\b(\d+[.,]?\d*)\s*unidades?\b/i);
    if (mUnidades) {
      const n = parseFloat(mUnidades[1].replace(',', '.'));
      if (Number.isFinite(n) && n >= 0) return n;
    }

    return undefined;
  }

  // Helper para normalizar mercado e linha_da_aposta para padronização
  private static normalizeBetData(betData: any): any {
    if (!betData) return betData;

    let mercado = betData.mercado || '';
    let linha_da_aposta = betData.linha_da_aposta || '';

    const mLower = mercado.toLowerCase();

    // Padronizar nomes de mercados
    if (
      mLower.includes('asian') || mLower.includes('asiático') || mLower.includes('asiatico') || /\bah\b/.test(mLower) || mLower.includes('hc')
    ) {
      mercado = 'Asian Handicap';
      // Padronizar formato AH (ex: AH+1.5, AH-0.5, AH+2.25) - preservar precisão decimal
      if (linha_da_aposta && !linha_da_aposta.startsWith('AH') && linha_da_aposta !== 'Múltipla' && linha_da_aposta !== 'Não identificado') {
        const match = linha_da_aposta.match(/([+-]?\d+[.,]?\d*)/);
        if (match) {
          const raw = match[1];
          const cleanValue = raw.replace(',', '.');
          const sign = cleanValue.startsWith('-') ? '-' : '+';
          const absVal = cleanValue.replace(/^[+\-]/, '');
          linha_da_aposta = `AH${sign}${absVal}`;
        }
      } else if (linha_da_aposta.startsWith('AH')) {
        const m2 = linha_da_aposta.match(/AH\s*([+-]?\d+[.,]?\d*)/i);
        if (m2) {
          const raw = m2[1];
          const cleanValue = raw.replace(',', '.');
          const sign = cleanValue.startsWith('-') ? '-' : '+';
          const absVal = cleanValue.replace(/^[+\-]/, '');
          linha_da_aposta = `AH${sign}${absVal}`;
        }
      }
    } else if (
      mLower.includes('goal') || mLower.includes('gol') || mLower.includes('gols') || mLower.includes('over') || mLower.includes('under')
    ) {
      mercado = 'Goal Line';
      // Padronizar formato Over/Under (ex: Over 2.5, Under 1.5) - preservar precisão
      if (linha_da_aposta && linha_da_aposta !== 'Múltipla' && linha_da_aposta !== 'Não identificado') {
        const match = linha_da_aposta.match(/(o|u|over|under)\s*([+-]?\d+[.,]?\d*)/i);
        if (match) {
          const type = match[1].toLowerCase();
          const value = match[2].replace(',', '.');
          const prefix = (type === 'o' || type === 'over') ? 'Over' : 'Under';
          linha_da_aposta = `${prefix} ${value}`;
        } else {
          // Apenas número presente
          const onlyNum = linha_da_aposta.match(/([+-]?\d+[.,]?\d*)/);
          if (onlyNum) {
            const value = onlyNum[1].replace(',', '.');
            linha_da_aposta = `Over ${value}`;
          }
        }
      }
    } else if (mLower.includes('resultado') || mLower.includes('1x2')) {
      mercado = 'Resultado Final';
    }

    // Padronizar mercados de finalizações
    if (mLower.includes('finaliza')) {
      mercado = 'Finalizações';
    }

    return {
      ...betData,
      mercado,
      linha_da_aposta
    };
  }

  static async parseBetMessage(message: string, chatId: number, userId: number, username: string): Promise<BetData | null> {
    if (!this.API_KEY) {
      console.error('GEMINI_API_KEY não configurada');
      return null;
    }

    try {
      const prompt = `
Analise esta mensagem de aposta do Telegram e extraia as informações em formato JSON válido.

Mensagem: "${message}"

Você deve extrair:
- jogo: Os times que estão jogando (formato: "Time A vs Time B")
- mercado: Tipo de aposta ("Goal Line", "Asian Handicap", "Resultado Final", "Over/Under", etc.)
- linha_da_aposta: A linha específica da aposta (ex: "GL +0.5", "AH -1.0", "Over 2.5", etc.)
- odd_tipster: A odd fornecida pelo tipster (apenas o número, ex: "1.85")

IMPORTANTE: Se a aposta for múltipla (ex.: múltipla, multi, parlay, bet builder/betbuilder, combinada, dupla, tripla, acca), defina mercado = "Múltipla" e linha_da_aposta = "Múltipla".

Exemplos de formato para linha_da_aposta:
- Goal Line: "GL +0.5", "GL -1.0", "GL 0.0"
- Asian Handicap: "AH +1.5", "AH -0.5", "AH 0.0"
- Over/Under: "Over 2.5", "Under 1.5"
- Resultado: "1", "X", "2"

Retorne APENAS um JSON válido no formato:
{
  "jogo": "Time A vs Time B",
  "mercado": "Goal Line",
  "linha_da_aposta": "GL +0.5",
  "odd_tipster": "1.85"
}

Se não conseguir extrair alguma informação, use null para esse campo.`;

      const response = await fetch(`${this.API_URL}?key=${this.API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 10000,
          }
        })
      });

      if (!response.ok) {
        console.error('Erro na API do Gemini:', response.status, response.statusText);
        return null;
      }

      const result: GeminiResponse = await response.json();
      
      if (!result.candidates || result.candidates.length === 0) {
        console.error('Nenhuma resposta do Gemini');
        return null;
      }

      const text = result.candidates[0].content.parts[0].text;
      console.log('Resposta do Gemini:', text);

      // Melhor regex para extrair JSON - aceita quebras de linha e espaços
      const jsonMatch = text.match(/\{[\s\S]*?\}/); // Mudança: regex mais robusta
      if (!jsonMatch) {
        console.error('JSON não encontrado na resposta do Gemini');
        return null;
      }

      let parsedData;
      try {
        parsedData = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error('Erro ao fazer parse do JSON:', parseError);
        return null;
      }
      
      // Forçar "Múltipla" quando identificado como aposta múltipla
      if (GeminiParser.isMultiBetText(message)) {
        parsedData.mercado = 'Múltipla';
        parsedData.linha_da_aposta = 'Múltipla';
      }

      // Aplicar normalização
      parsedData = this.normalizeBetData(parsedData);

      // Criar objeto BetData
      const timestamp = Date.now();
      const betId = `BET${timestamp.toString().slice(-8)}_${chatId.toString().slice(-4)}_${userId.toString().slice(-4)}`;

      // Extrair stake da mensagem
      const stake = this.extractStake(message) ?? 1;
      
      const betData: BetData = {
        id: `bet_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
        betId,
        chatId,
        userId,
        username,
        message,
        data: new Date(),
        jogo: parsedData.jogo || 'Não identificado',
        mercado: parsedData.mercado || 'Pendente',
        linha_da_aposta: parsedData.linha_da_aposta || 'Não identificado',
        odd_tipster: parseFloat(parsedData.odd_tipster) || 0,
        placar: normalizeScore(parsedData.placar || '0-0'),
        pegou: null, // Consistente com parser.ts
        odd_real: null, // Consistente com parser.ts
        resultado_aposta: 'Pendente',
        stake
      };

      return betData;

    } catch (error) {
      console.error('Erro ao analisar mensagem com Gemini:', error);
      return null;
    }
  }

  static async parseImageMessage(
    imageUrlOrNull: string | null,
    caption: string,
    chatId: number,
    userId: number,
    username: string,
    options?: { imageBuffer?: Buffer | Uint8Array | ArrayBuffer; base64Data?: string; mimeType?: string }
  ): Promise<BetData | null> {
    if (!this.API_KEY) {
      console.error('GEMINI_API_KEY não configurada');
      return null;
    }

    try {
      const imageSourceDesc = options?.base64Data
        ? 'base64'
        : options?.imageBuffer
        ? 'buffer'
        : imageUrlOrNull || 'desconhecido';
      console.log('🖼️ Analisando imagem com Gemini a partir de:', imageSourceDesc);
      
      // Preparar a imagem em base64 e mimeType
      let base64Image: string;
      let mimeType = options?.mimeType || 'image/jpeg';

      if (options?.base64Data) {
        base64Image = options.base64Data;
      } else if (options?.imageBuffer) {
        let buf: Buffer;
        if (options.imageBuffer instanceof Buffer) {
          buf = options.imageBuffer;
        } else if (options.imageBuffer instanceof Uint8Array) {
          buf = Buffer.from(options.imageBuffer as Uint8Array);
        } else {
          buf = Buffer.from(new Uint8Array(options.imageBuffer as ArrayBuffer));
        }
        base64Image = buf.toString('base64');
      } else if (imageUrlOrNull) {
        // Baixar a imagem e converter para base64 (retrocompatibilidade com URL)
        const imageResponse = await fetch(imageUrlOrNull);
        if (!imageResponse.ok) {
          console.error('Erro ao baixar imagem:', imageResponse.status);
          return null;
        }
        // Tentar obter o mime type a partir do response
        const respContentType = imageResponse.headers.get('content-type');
        if (respContentType) mimeType = respContentType.split(';')[0];
        const imageBuffer = await imageResponse.arrayBuffer();
        base64Image = Buffer.from(imageBuffer).toString('base64');
      } else {
        console.error('Nenhuma fonte de imagem fornecida (URL, buffer ou base64)');
        return null;
      }
      
      const prompt = `
Analise esta imagem de aposta esportiva e extraia as informações em formato JSON válido.

${caption ? `Legenda da imagem: "${caption}"` : ''}

Você deve extrair:
- jogo: Os times que estão jogando (formato: "Time A vs Time B")
- mercado: Tipo de aposta ("Goal Line", "Asian Handicap", "Resultado Final", "Over/Under", etc.)
- linha_da_aposta: A linha específica da aposta (ex: "GL +0.5", "AH -1.0", "Over 2.5", etc.)
- odd_tipster: A odd fornecida pelo tipster (apenas o número, ex: "1.85")

IMPORTANTE: Se a aposta for múltipla (ex.: múltipla, multi, parlay, bet builder/betbuilder, combinada, dupla, tripla, acca), defina mercado = "Múltipla" e linha_da_aposta = "Múltipla".

Exemplos de formato para linha_da_aposta:
- Goal Line: "GL +0.5", "GL -1.0", "GL 0.0"
- Asian Handicap: "AH +1.5", "AH -0.5", "AH 0.0"
- Over/Under: "Over 2.5", "Under 1.5"
- Resultado: "1", "X", "2"

Retorne APENAS um JSON válido no formato:
{
  "jogo": "Time A vs Time B",
  "mercado": "Goal Line",
  "linha_da_aposta": "GL +0.5",
  "odd_tipster": "1.85"
}

Se não conseguir extrair alguma informação, use null para esse campo.`;

      const response = await fetch(`${this.API_URL}?key=${this.API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: prompt
              },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Image
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 10000,
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro na API do Gemini:', response.status, response.statusText, errorText);
        return null;
      }

      const result: GeminiResponse = await response.json();
      
      if (!result.candidates || result.candidates.length === 0) {
        console.error('Nenhuma resposta do Gemini para imagem');
        return null;
      }

      const text = result.candidates[0].content.parts[0].text;
      console.log('Resposta do Gemini para imagem:', text);

      // Melhor regex para extrair JSON
      const jsonMatch = text.match(/\{[\s\S]*?\}/); // Mudança: regex mais robusta
      if (!jsonMatch) {
        console.error('JSON não encontrado na resposta do Gemini para imagem');
        return null;
      }

      let parsedData;
      try {
        parsedData = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error('Erro ao fazer parse do JSON da imagem:', parseError);
        return null;
      }
      
      // Forçar "Múltipla" quando identificado como aposta múltipla
      if (GeminiParser.isMultiBetText(caption)) {
        parsedData.mercado = 'Múltipla';
        parsedData.linha_da_aposta = 'Múltipla';
      }
      
      // Aplicar normalização
      parsedData = this.normalizeBetData(parsedData);

      // Criar objeto BetData
      const timestamp = Date.now();
      const betId = `BET${timestamp.toString().slice(-8)}_${chatId.toString().slice(-4)}_${userId.toString().slice(-4)}`;
      
      // Extrair stake da caption se houver
      const stake = this.extractStake(caption || '') ?? 1;
      
      const betData: BetData = {
        id: `bet_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
        betId,
        chatId,
        userId,
        username,
        message: caption || '[Imagem de aposta]',
        data: new Date(),
        jogo: parsedData.jogo || 'Não identificado',
        mercado: parsedData.mercado || 'Pendente',
        linha_da_aposta: parsedData.linha_da_aposta || 'Não identificado',
        odd_tipster: parseFloat(parsedData.odd_tipster) || 0,
        placar: normalizeScore(parsedData.placar || '0-0'),
        pegou: null, // Consistente com parser.ts
        odd_real: null, // Consistente com parser.ts
        resultado_aposta: 'Pendente',
        stake
      };

      return betData;

    } catch (error) {
      console.error('Erro ao analisar imagem com Gemini:', error);
      return null;
    }
  }

  static createConfirmationMessage(betData: BetData): string {
    return `🎯 *Aposta detectada!*\n\n` +
           `🏆 *Jogo:* ${betData.jogo}\n` +
           `📊 *Mercado:* ${betData.mercado}\n` +
           `🎲 *Linha:* ${betData.linha_da_aposta}\n` +
           `💰 *Odd Tipster:* ${formatOddBrazilian(betData.odd_tipster)}` +
           `${betData.stake !== undefined ? `\n📦 *Stake:* ${betData.stake}u` : ''}\n\n` +
           `❓ Você pegou essa aposta? (Responda: sim/não)`;
  }
}