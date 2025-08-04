import { BetData } from '../telegram/parser';

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
  private static readonly API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

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
            maxOutputTokens: 200,
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
      
      // Criar objeto BetData
      const betData: BetData = {
        id: `bet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        chatId,
        userId,
        username,
        message,
        data: new Date(),
        jogo: parsedData.jogo || 'Não identificado',
        mercado: parsedData.mercado || 'Pendente',
        linha_da_aposta: parsedData.linha_da_aposta || 'Não identificado',
        odd_tipster: parseFloat(parsedData.odd_tipster) || 0,
        pegou: null, // Consistente com parser.ts
        odd_real: null, // Consistente com parser.ts
        resultado_aposta: 'Pendente'
      };

      return betData;

    } catch (error) {
      console.error('Erro ao analisar mensagem com Gemini:', error);
      return null;
    }
  }

  static async parseImageMessage(imageUrl: string, caption: string, chatId: number, userId: number, username: string): Promise<BetData | null> {
    if (!this.API_KEY) {
      console.error('GEMINI_API_KEY não configurada');
      return null;
    }

    try {
      console.log('🖼️ Analisando imagem com Gemini:', imageUrl);
      
      // Baixar a imagem e converter para base64
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        console.error('Erro ao baixar imagem:', imageResponse.status);
        return null;
      }
      
      const imageBuffer = await imageResponse.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString('base64');
      
      const prompt = `
Analise esta imagem de aposta esportiva e extraia as informações em formato JSON válido.

${caption ? `Legenda da imagem: "${caption}"` : ''}

Você deve extrair:
- jogo: Os times que estão jogando (formato: "Time A vs Time B")
- mercado: Tipo de aposta ("Goal Line", "Asian Handicap", "Resultado Final", "Over/Under", etc.)
- linha_da_aposta: A linha específica da aposta (ex: "GL +0.5", "AH -1.0", "Over 2.5", etc.)
- odd_tipster: A odd fornecida pelo tipster (apenas o número, ex: "1.85")

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
                  mime_type: 'image/jpeg',
                  data: base64Image
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 300,
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
      
      // Criar objeto BetData
      const betData: BetData = {
        id: `bet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        chatId,
        userId,
        username,
        message: caption || '[Imagem de aposta]',
        data: new Date(),
        jogo: parsedData.jogo || 'Não identificado',
        mercado: parsedData.mercado || 'Pendente',
        linha_da_aposta: parsedData.linha_da_aposta || 'Não identificado',
        odd_tipster: parseFloat(parsedData.odd_tipster) || 0,
        pegou: null, // Consistente com parser.ts
        odd_real: null, // Consistente com parser.ts
        resultado_aposta: 'Pendente'
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
           `💰 *Odd Tipster:* ${betData.odd_tipster}\n\n` +
           `❓ Você pegou essa aposta? (Responda: sim/não)`;
  }
}