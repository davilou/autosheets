import { google } from 'googleapis';
import { BetData } from '../../types/bet-data';
import { normalizeScore, formatOddBrazilian } from '../utils';

interface SheetsConfig {
  spreadsheetId: string;
  range: string;
  credentials: {
    client_email: string;
    private_key: string;
  };
}

class GoogleSheetsService {
  private sheets: any;
  private auth: any;
  private config: SheetsConfig;

  constructor(config: SheetsConfig) {
    this.config = config;
    this.initializeAuth();
  }

  private async initializeAuth() {
    try {
      this.auth = new google.auth.GoogleAuth({
        credentials: this.config.credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    } catch (error) {
      console.error('Erro ao inicializar autenticação Google Sheets:', error);
      throw error;
    }
  }

  // Garante que o valor será tratado como texto no Google Sheets (preserva zeros à esquerda)
  private ensureText(value: string | null | undefined): string {
    const v = (value ?? '').toString();
    // Se já tiver apóstrofo no começo, mantém; caso contrário, adiciona
    return v.startsWith("'") ? v : "'" + v;
  }

  // Normaliza betIds numéricos para comparação (remove zeros à esquerda)
  private normalizeNumericId(id: string): string {
    const v = (id ?? '').toString().trim().replace(/^'/, '');
    if (/^\d+$/.test(v)) {
      const stripped = v.replace(/^0+/, '');
      return stripped.length > 0 ? stripped : '0';
    }
    return v;
  }

  // Compara dois betIds considerando zeros à esquerda em ids puramente numéricos
  private isBetIdMatch(a: string | undefined, b: string | undefined): boolean {
    const aStr = (a ?? '').toString().trim().replace(/^'/, '');
    const bStr = (b ?? '').toString().trim().replace(/^'/, '');

    if (aStr === bStr) return true;

    const aIsNum = /^\d+$/.test(aStr);
    const bIsNum = /^\d+$/.test(bStr);
    if (aIsNum && bIsNum) {
      return this.normalizeNumericId(aStr) === this.normalizeNumericId(bStr);
    }

    return false;
  }

  // Detecta e anexa o nome do time à linha de handicap asiático (AH)
  private buildLinhaDaApostaForSheets(betData: BetData): string {
    try {
      const baseLine = (betData.linha_da_aposta || '').trim();
      const mercado = (betData.mercado || '').trim();
      if (!baseLine) return baseLine;

      // Novo: tratar Resultado Final (1X2) mapeando 1=casa, 2=fora, X=empate para exibição na planilha
      if (mercado === 'Resultado Final') {
        const jogo = (betData.jogo || '').trim();
        if (!jogo) return baseLine;

        // Suporta separadores comuns: vs, x, vs., ×, hífen e traços (–, —)
        const splitMatch = jogo.split(/\s+(?:vs|x|vs\.|×|—|–|-|—)\s+/i);
        const teamA = (splitMatch[0] || '').trim();
        const teamB = (splitMatch[1] || '').trim();
        if (!teamA && !teamB) return baseLine;

        const normalized = baseLine.toUpperCase();
        if (normalized === '1') return teamA || baseLine;
        if (normalized === '2') return teamB || baseLine;
        if (normalized === 'X') return 'Empate';

        return baseLine; // Qualquer outro formato, mantém
      }

      // Se não for Asian Handicap, retorna como está
      if (mercado !== 'Asian Handicap') return baseLine;

      const jogo = (betData.jogo || '').trim();
      if (!jogo) return baseLine;

      const splitMatch = jogo.split(/\s+(?:vs|x|vs\.|×|—|–|-|—)\s+/i);
      const teamA = (splitMatch[0] || '').trim();
      const teamB = (splitMatch[1] || '').trim();
      if (!teamA && !teamB) return baseLine;

      const normalize = (s: string) => s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const msg = normalize(betData.message || '');
      const tA = normalize(teamA);
      const tB = normalize(teamB);

      // Encontrar posição de referência (termo handicap ou número com sinal)
      const idxAH = msg.indexOf('ah');
      const idxHC = msg.indexOf('hc');
      const idxHandicap = msg.indexOf('handicap');
      const idxSign = (() => {
        const m = msg.match(/([+\-]\d+(?:[\.,]\d+)?)/);
        return m ? msg.indexOf(m[1]) : -1;
      })();
      const refPosCandidates = [idxAH, idxHC, idxHandicap, idxSign].filter(i => i >= 0);
      const refPos = refPosCandidates.length ? Math.min(...refPosCandidates) : -1;

      // Procurar índices dos times na mensagem original
      const idxTeamA = tA ? msg.indexOf(tA) : -1;
      const idxTeamB = tB ? msg.indexOf(tB) : -1;

      let chosenTeam: string | null = null;
      if (idxTeamA >= 0 && idxTeamB < 0) {
        chosenTeam = teamA;
      } else if (idxTeamB >= 0 && idxTeamA < 0) {
        chosenTeam = teamB;
      } else if (idxTeamA >= 0 && idxTeamB >= 0 && refPos >= 0) {
        const dA = Math.abs(refPos - idxTeamA);
        const dB = Math.abs(refPos - idxTeamB);
        chosenTeam = dA <= dB ? teamA : teamB;
      }
      if (!chosenTeam) {
        if (idxTeamA > idxTeamB && idxTeamA >= 0) chosenTeam = teamA;
        else if (idxTeamB > idxTeamA && idxTeamB >= 0) chosenTeam = teamB;
      }
      if (!chosenTeam) return baseLine;

      // Normalizar visual do AH para manter padrão, preservando precisão existente
      const normalizedAH = baseLine.replace(/AH\s*/i, (m) => m.trim().toUpperCase());

      // Formato preferencial: "AH+X TeamName"
      return `${normalizedAH} ${chosenTeam}`.trim();
    } catch (_) {
      return betData.linha_da_aposta;
    }
  }

  async addBetData(betData: BetData): Promise<boolean> {
    try {
      if (!this.sheets) {
        await this.initializeAuth();
      }
      console.log('Dados recebidos para salvar:', betData);
      
      const values = this.formatBetDataForSheets(betData);
      console.log('Valores formatados:', values);
      
      const request = {
        spreadsheetId: this.config.spreadsheetId,
        range: this.config.range,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [values],
        },
      };

      console.log('Enviando para Google Sheets:', request);
      const response = await this.sheets.spreadsheets.values.append(request);
      
      console.log('Resposta do Google Sheets:', response.status, response.statusText);
      
      if (response.status === 200) {
        console.log('✅ Dados adicionados com sucesso ao Google Sheets');
        return true;
      }
      
      console.error('❌ Falha ao adicionar dados - Status:', response.status);
      return false;
    } catch (error) {
      console.error('❌ Erro ao adicionar dados ao Google Sheets:', error);
      if (error instanceof Error && (error as any).response) {
        console.error('Detalhes do erro:', (error as any).response.data);
      }
      return false;
    }
  }

  async addMultipleBetData(betDataArray: BetData[]): Promise<number> {
    if (betDataArray.length === 0) return 0;
    
    try {
      const values = betDataArray.map(bet => this.formatBetDataForSheets(bet));
      
      const request = {
        spreadsheetId: this.config.spreadsheetId,
        range: this.config.range,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values,
        },
      };

      const response = await this.sheets.spreadsheets.values.append(request);
      
      if (response.status === 200) {
        console.log(`${betDataArray.length} registros adicionados com sucesso`);
        return betDataArray.length;
      }
      
      return 0;
    } catch (error) {
      console.error('Erro ao adicionar múltiplos dados:', error);
      return 0;
    }
  }

  private formatBetDataForSheets(betData: BetData): any[] {
    // Formatação para a estrutura da planilha (12 colunas após remoção de Bateu? e Lucro/Prejuízo)
    const dataCompleta = betData.data instanceof Date 
      ? betData.data 
      : new Date(betData.data);

    const linhaParaSheets = this.buildLinhaDaApostaForSheets(betData);
    
    return [
      this.ensureText(betData.betId || ''),                 // A - BetId (como texto para preservar zeros à esquerda)
      dataCompleta.toLocaleDateString('pt-BR'),             // B - Data
      dataCompleta.toLocaleTimeString('pt-BR'),             // C - Hora
      betData.jogo,                                         // D - Jogo
      normalizeScore(betData.placar || '0-0'),              // E - Placar
      betData.mercado,                                      // F - Mercado
      linhaParaSheets,                                      // G - Linha da Aposta
      typeof betData.odd_tipster === 'number' 
        ? formatOddBrazilian(betData.odd_tipster) 
        : betData.odd_tipster,                              // H - Odd Tipster (com vírgula)
      betData.pegou === true ? 'Sim' : 
      betData.pegou === false ? 'Não' : '',                 // I - Pegou
      betData.odd_real && betData.odd_real > 0 
        ? formatOddBrazilian(betData.odd_real) : '',        // J - Odd Real (com vírgula)
      // K - Stake: forçar vírgula como separador decimal
      betData.stake !== undefined 
        ? (typeof betData.stake === 'number' 
            ? betData.stake.toString().replace('.', ',') 
            : String(betData.stake).replace('.', ',')) 
        : '',
      betData.groupName || '',                              // L - Grupo (novo)
      'Pendente',                                           // M - Resultado (dropdown padrão)
    ];
  }

  async createHeaderRow(): Promise<boolean> {
    try {
      const headers = [
        'BetId',                 // A
        'Data',                  // B
        'Hora',                  // C
        'Jogo',                  // D
        'Placar',                // E
        'Mercado',               // F
        'Linha_da_Aposta',       // G
        'Odd_Tipster',           // H
        'Pegou',                 // I
        'Odd_Real',              // J
        'Valor_Apostado',        // K
        'Grupo',                 // L (novo)
        'Resultado'              // M
      ];
  
      const request = {
        spreadsheetId: this.config.spreadsheetId,
        range: 'A1:M1',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [headers],
        },
      };
  
      const response = await this.sheets.spreadsheets.values.update(request);
      console.log('Cabeçalho criado:', response.status === 200 ? 'Sucesso' : 'Falha');
      return response.status === 200;
    } catch (error) {
      console.error('Erro ao criar cabeçalho:', error);
      return false;
    }
  }

  async updateResultado(rowNumber: number, resultado: string): Promise<boolean> {
    try {
      const range = `M${rowNumber}:M${rowNumber}`; // Coluna M - Resultado
      const response = await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.config.spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[resultado]] }
      });
      return response.status === 200;
    } catch (error) {
      console.error('Erro ao atualizar Resultado:', error);
      return false;
    }
  }

  async getSheetData(range?: string): Promise<any[]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range: range || this.config.range,
      });

      return response.data.values || [];
    } catch (error) {
      console.error('Erro ao buscar dados da planilha:', error);
      return [];
    }
  }

  // NOVO: Método para atualizar odd de uma aposta específica por betId
  async updateBetOddByBetId(betId: string, oddReal: number | null, stake?: number): Promise<boolean> {
    try {
      console.log('🔍 Procurando aposta por betId:', betId);
      
      // Buscar todas as linhas da planilha
      const allData = await this.getSheetData();
      
      if (allData.length === 0) {
        console.error('❌ Planilha vazia ou sem dados');
        return false;
      }
      
      console.log(`📋 Total de linhas na planilha: ${allData.length}`);
      
      // Encontrar a linha correspondente pelo betId (coluna A)
      let targetRowIndex = -1;
      
      const target = (betId ?? '').toString();
      for (let i = 1; i < allData.length; i++) {
        const row = allData[i];
        const rowBetId = row[0]; // Coluna A - BetId
        
        if (this.isBetIdMatch(rowBetId, target)) {
          targetRowIndex = i + 1; // +1 porque as linhas começam em 1
          console.log(`🎯 Aposta encontrada na linha ${targetRowIndex} com betId (planilha vs alvo):`, rowBetId, target);
          break;
        }
      }
      
      if (targetRowIndex === -1) {
        console.log(`❌ Aposta com betId ${betId} não encontrada na planilha`);
        return false;
      }
      
      // Atualizar as colunas I (Pegou) e J (Odd_Real) e, opcionalmente, K (Valor_Apostado)
      const pegouValue = oddReal === null || oddReal === 0 ? 'Não' : 'Sim';
      const oddRealValue = oddReal && oddReal > 0 ? formatOddBrazilian(oddReal) : '';
      const stakeValue = (oddReal && oddReal > 0 && stake !== undefined) ? stake.toString().replace('.', ',') : undefined;

      const range = stakeValue === undefined ? `I${targetRowIndex}:J${targetRowIndex}` : `I${targetRowIndex}:K${targetRowIndex}`;
      const values = stakeValue === undefined
        ? [[pegouValue, oddRealValue]]
        : [[pegouValue, oddRealValue, stakeValue]];

      const response = await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.config.spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values }
      });

      console.log('📌 Atualização de odd concluída:', response.status === 200 ? 'Sucesso' : 'Falha');
      return response.status === 200;
    } catch (error) {
      console.error('❌ Erro ao atualizar odd na planilha:', error);
      return false;
    }
  }

  async updateBetOdd(betData: BetData, oddReal: number | null): Promise<boolean> {
    try {
      return this.updateBetOddByBetId(betData.betId, oddReal, betData.stake);
    } catch (error) {
      console.error('Erro ao atualizar odd de betData:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.config.spreadsheetId,
      });
      return response.status === 200;
    } catch (error) {
      console.error('Erro ao testar conexão com Google Sheets:', error);
      return false;
    }
  }
}

export default GoogleSheetsService;
export type { SheetsConfig };