import { google } from 'googleapis';
import { BetData } from '../telegram/parser'; // Mudança aqui!
import { SHEETS_CONFIG } from '../security/config';

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

  async addBetData(betData: BetData): Promise<boolean> {
    try {
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
    // Formatação corrigida para a estrutura real da planilha
    return [
      betData.data instanceof Date 
        ? betData.data.toLocaleString('pt-BR') 
        : new Date(betData.data).toLocaleString('pt-BR'),    // A - Data
      betData.jogo,                                         // B - Jogo
      betData.placar || '0-0',                              // C - Placar (MUDANÇA: usar "0-0" como padrão)
      betData.linha_da_aposta,                              // D - Linha_da_Aposta
      betData.mercado,                                      // E - Mercado
      typeof betData.odd_tipster === 'number' 
        ? betData.odd_tipster.toString() 
        : betData.odd_tipster,                              // F - Odd_Tipster
      betData.pegou === true ? 'SIM' : 
      betData.pegou === false ? 'NÃO' : 'PENDENTE',        // G - Pegou
      betData.odd_real ? betData.odd_real.toString() : '', // H - Odd_Real
      '',                                                   // I - Resultado_Jogo (vazio inicialmente)
      betData.resultado_aposta || 'Pendente',               // J - Resultado_Aposta
    ];
  }

  async createHeaderRow(): Promise<boolean> {
    try {
      const headers = [
        'Data',                  // A
        'Jogo',                  // B
        'Placar',                // C
        'Linha_da_Aposta',       // D
        'Mercado',               // E
        'Odd_Tipster',           // F
        'Pegou',                 // G
        'Odd_Real',              // H
        'Resultado_Jogo',        // I
        'Resultado_Aposta'       // J
      ];
  
      const request = {
        spreadsheetId: this.config.spreadsheetId,
        range: 'A1:J1',
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

  // Método para testar a conexão
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.config.spreadsheetId
      });
      
      console.log('✅ Conexão com Google Sheets OK:', response.data.properties.title);
      return true;
    } catch (error) {
      console.error('❌ Erro na conexão com Google Sheets:', error);
      return false;
    }
  }
}

export default GoogleSheetsService;
export type { SheetsConfig };