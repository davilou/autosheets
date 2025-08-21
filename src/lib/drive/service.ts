import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { OAuth2Client } from 'google-auth-library';

interface DriveConfig {
  credentials?: {
    client_email: string;
    private_key: string;
  };
  oauth?: {
    access_token: string;
    refresh_token: string;
  };
}

interface SpreadsheetTemplate {
  title: string;
  headers: string[];
  defaultData?: string[][];
}

interface CreatedSpreadsheet {
  id: string;
  name: string;
  url: string;
  createdAt: Date;
}

class GoogleDriveService {
  private drive: any;
  private sheets: any;
  private auth!: JWT | OAuth2Client;
  private config: DriveConfig;

  constructor(config: DriveConfig) {
    this.config = config;
  }

  async initialize() {
    await this.initializeAuth();
  }

  private async initializeAuth() {
    try {
      console.log('🔧 Inicializando autenticação Google Drive...');
      
      // Verificar se é OAuth2 ou Service Account
      if (this.config.oauth) {
        console.log('🔐 Usando autenticação OAuth2...');
        console.log('🎫 Access Token:', this.config.oauth.access_token ? 'Definido' : 'Não definido');
        console.log('🔄 Refresh Token:', this.config.oauth.refresh_token ? 'Definido' : 'Não definido');
        
        if (!this.config.oauth.access_token || !this.config.oauth.refresh_token) {
          throw new Error('Tokens OAuth2 não estão configurados corretamente');
        }
        
        // Configurar OAuth2 client
        this.auth = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_REDIRECT_URI
        );
        
        // Configurar tokens
        this.auth.setCredentials({
          access_token: this.config.oauth.access_token,
          refresh_token: this.config.oauth.refresh_token
        });
        
        console.log('✅ OAuth2 configurado com sucesso');
      } else if (this.config.credentials) {
        console.log('🔐 Usando autenticação Service Account...');
        console.log('📧 Client Email:', this.config.credentials.client_email ? 'Definido' : 'Não definido');
        console.log('🔑 Private Key:', this.config.credentials.private_key ? 'Definido' : 'Não definido');
        
        if (!this.config.credentials.client_email || !this.config.credentials.private_key) {
          throw new Error('Credenciais do Google Drive não estão configuradas corretamente');
        }
        
        // Processar a chave privada para garantir formatação correta
        const privateKey = this.config.credentials.private_key.replace(/\\n/g, '\n');
        
        this.auth = new google.auth.JWT({
          email: this.config.credentials.client_email,
          key: privateKey,
          scopes: [
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/spreadsheets'
          ]
        });

        if (this.auth instanceof JWT) {
          await this.auth.authorize();
        }
        console.log('✅ Service Account autorizado com sucesso');
      } else {
        throw new Error('Nenhuma configuração de autenticação fornecida');
      }

      this.drive = google.drive({ version: 'v3', auth: this.auth });
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });

      console.log('✅ Google Drive API inicializada com sucesso');
    } catch (error) {
      console.error('❌ Erro ao inicializar Google Drive API:', error);
      throw error;
    }
  }

  /**
   * Cria uma nova planilha do Google Sheets
   */
  async createSpreadsheet(template: SpreadsheetTemplate, userEmail?: string): Promise<CreatedSpreadsheet> {
    try {
      const finalTitle = userEmail ? `Planilha ${userEmail}` : template.title;
      console.log('📊 Criando nova planilha:', finalTitle);

      // Criar planilha usando Sheets API
      const createResponse = await this.sheets.spreadsheets.create({
        resource: {
          properties: {
            title: finalTitle
          },
          sheets: [{
            properties: {
              title: 'Dados',
              gridProperties: {
                rowCount: 1000,
                columnCount: template.headers.length
              }
            }
          }]
        }
      });

      const spreadsheetId = createResponse.data.spreadsheetId;
      const spreadsheetUrl = createResponse.data.spreadsheetUrl;

      console.log('✅ Planilha criada:', spreadsheetId);

      // Adicionar cabeçalhos
      if (template.headers.length > 0) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId,
          range: 'A1',
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [template.headers]
          }
        });

        console.log('✅ Cabeçalhos adicionados à planilha');
      }

      // Adicionar dados padrão se fornecidos
      if (template.defaultData && template.defaultData.length > 0) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId,
          range: 'A2',
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: template.defaultData
          }
        });

        console.log('✅ Dados padrão adicionados à planilha');
      }

      // Configurar permissões se email do usuário foi fornecido
      if (userEmail) {
        await this.shareSpreadsheet(spreadsheetId, userEmail, 'writer');
      }

      // Compartilhar automaticamente com o email do serviço Google (env ou fallback)
      const DEFAULT_SERVICE_EMAIL = 'apostas-bot-service@enxame-de-agentes-463217.iam.gserviceaccount.com';
      const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || DEFAULT_SERVICE_EMAIL;
      if (serviceEmail) {
        console.log('🔗 Compartilhando planilha com o serviço Google:', serviceEmail);
        await this.shareSpreadsheet(spreadsheetId, serviceEmail, 'writer');
      }

      // Obter o sheetId real da aba 'Dados'
      const createdSheets = (createResponse.data.sheets as any) || [];
      const createdSheetId = createdSheets[0]?.properties?.sheetId;
      const sheetId = typeof createdSheetId === 'number' ? createdSheetId : await this.getSheetId(spreadsheetId, 'Dados');

      // Formatar cabeçalhos e aplicar validação com sheetId correto
      await this.formatHeaders(spreadsheetId, sheetId);

      return {
        id: spreadsheetId,
        name: finalTitle,
        url: spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
        createdAt: new Date()
      };
    } catch (error) {
      console.error('❌ Erro ao criar planilha:', error);
      throw error;
    }
  }

  /**
   * Compartilha uma planilha com um usuário
   */
  async shareSpreadsheet(spreadsheetId: string, email: string, role: 'reader' | 'writer' | 'owner' = 'writer'): Promise<boolean> {
    try {
      console.log(`🔗 Compartilhando planilha ${spreadsheetId} com ${email} como ${role}`);

      await this.drive.permissions.create({
        fileId: spreadsheetId,
        resource: {
          role,
          type: 'user',
          emailAddress: email
        },
        sendNotificationEmail: true
      });

      console.log('✅ Planilha compartilhada com sucesso');
      return true;
    } catch (error) {
      console.error('❌ Erro ao compartilhar planilha:', error);
      return false;
    }
  }

  /**
   * Lista planilhas criadas pelo serviço
   */
  async listUserSpreadsheets(): Promise<any[]> {
    try {
      const response = await this.drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
        fields: 'files(id, name, createdTime, modifiedTime, webViewLink, owners, quotaBytesUsed)',
        orderBy: 'createdTime desc'
      });

      return response.data.files || [];
    } catch (error) {
      console.error('❌ Erro ao listar planilhas:', error);
      return [];
    }
  }

  /**
   * Cria backup de uma planilha
   */
  async createBackup(spreadsheetId: string, backupName?: string): Promise<string | null> {
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const finalBackupName = backupName || `Backup_${timestamp}`;

      console.log(`💾 Criando backup: ${finalBackupName}`);

      const response = await this.drive.files.copy({
        fileId: spreadsheetId,
        resource: {
          name: finalBackupName
        }
      });

      console.log('✅ Backup criado com sucesso:', response.data.id);
      return response.data.id;
    } catch (error) {
      console.error('❌ Erro ao criar backup:', error);
      return null;
    }
  }

  /**
   * Obtém permissões (compartilhamentos) de um arquivo
   */
  async getFilePermissions(fileId: string): Promise<Array<{ emailAddress?: string; role?: string; type?: string }>> {
    try {
      const res = await this.drive.permissions.list({
        fileId,
        fields: 'permissions(emailAddress,role,type)'
      });
      return res.data.permissions || [];
    } catch (error) {
      console.error('❌ Erro ao obter permissões do arquivo:', error);
      return [];
    }
  }

  /**
   * Obtém metadados de um arquivo, incluindo quotaBytesUsed
   */
  async getFileMetadata(fileId: string): Promise<{ id: string; name: string; quotaBytesUsed?: string; modifiedTime?: string } | null> {
    try {
      const res = await this.drive.files.get({
        fileId,
        fields: 'id,name,quotaBytesUsed,modifiedTime'
      });
      return res.data as any;
    } catch (error) {
      console.error('❌ Erro ao obter metadados do arquivo:', error);
      return null;
    }
  }

  /**
   * Lista backups relacionados a uma planilha, procurando pelo prefixo do ID no nome do arquivo
   */
  async listBackupsForSpreadsheet(spreadsheetId: string): Promise<Array<{ id: string; name: string; createdTime: string; quotaBytesUsed?: string }>> {
    try {
      const idPrefix = spreadsheetId.substring(0, 8);
      const q = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and name contains 'Backup_' and name contains '" + idPrefix + "'";
      const res = await this.drive.files.list({
        q,
        fields: 'files(id,name,createdTime,quotaBytesUsed)',
        orderBy: 'createdTime desc'
      });
      return (res.data.files as any) || [];
    } catch (error) {
      console.error('❌ Erro ao listar backups da planilha:', error);
      return [];
    }
  }

  /**
   * Formata os cabeçalhos da planilha
   */
  private async formatHeaders(spreadsheetId: string, sheetId: number): Promise<void> {
    try {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: {
                      red: 0.2,
                      green: 0.6,
                      blue: 0.9
                    },
                    textFormat: {
                      foregroundColor: {
                        red: 1.0,
                        green: 1.0,
                        blue: 1.0
                      },
                      bold: true
                    }
                  }
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat)'
              }
            },
            {
              updateDimensionProperties: {
                range: {
                  sheetId,
                  dimension: 'ROWS',
                  startIndex: 0,
                  endIndex: 1
                },
                properties: {
                  pixelSize: 40
                },
                fields: 'pixelSize'
              }
            },
            {
              setDataValidation: {
                range: {
                  sheetId,
                  startRowIndex: 1,
                  // endRowIndex removido para aplicar à coluna inteira (todas as linhas)
                  startColumnIndex: 12,
                  endColumnIndex: 13
                },
                rule: {
                  condition: {
                    type: 'ONE_OF_LIST',
                    values: [
                      { userEnteredValue: 'Pendente' },
                      { userEnteredValue: 'Green' },
                      { userEnteredValue: 'Red' }
                    ]
                  },
                  showCustomUi: true,
                  strict: true
                }
              }
            }
          ]
        }
      });

      console.log('✅ Cabeçalhos formatados e validação de dados configurada');
    } catch (error) {
      console.error('❌ Erro ao formatar cabeçalhos:', error);
    }
  }

  /**
   * Reaplica validação de dados na coluna Resultado para planilhas existentes
   */
  async reapplyResultadoValidation(spreadsheetId: string): Promise<boolean> {
    try {
      const sheetId = await this.getSheetId(spreadsheetId, 'Dados');
      if (!sheetId) {
        console.error('❌ Sheet ID não encontrado para revalidar');
        return false;
      }

      // Reaplicar validação apenas na coluna Resultado (coluna 13, índice 12)
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests: [
            {
              setDataValidation: {
                range: {
                  sheetId,
                  startRowIndex: 1,
                  startColumnIndex: 12,
                  endColumnIndex: 13
                },
                rule: {
                  condition: {
                    type: 'ONE_OF_LIST',
                    values: [
                      { userEnteredValue: 'Pendente' },
                      { userEnteredValue: 'Green' },
                      { userEnteredValue: 'Red' }
                    ]
                  },
                  showCustomUi: true,
                  strict: true
                }
              }
            }
          ]
        }
      });

      console.log('✅ Validação reaplicada com sucesso');
      return true;
    } catch (error) {
      console.error('❌ Erro ao reaplicar validação:', error);
      return false;
    }
  }

  /**
   * Obtém informações de uma planilha
   */
  async getSpreadsheetInfo(spreadsheetId: string): Promise<any> {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao obter informações da planilha:', error);
      return null;
    }
  }

  /**
   * Testa a conexão com as APIs
   */
  async testConnection(): Promise<boolean> {
    try {
      // Verificar acesso à API Drive e Sheets
      await this.drive.files.list({ pageSize: 1 });
      await this.sheets.spreadsheets.get({ spreadsheetId: 'dummy', includeGridData: false }).catch(() => {});
      return true;
    } catch (error) {
      console.error('❌ Erro ao testar conexão com Google APIs:', error);
      return false;
    }
  }

  private async getSheetId(spreadsheetId: string, title?: string): Promise<number> {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId
      });
      const sheets = response.data.sheets || [];
      if (title) {
        const sheet = sheets.find((s: any) => s.properties?.title === title);
        return sheet?.properties?.sheetId || sheets[0]?.properties?.sheetId || 0;
      }
      return sheets[0]?.properties?.sheetId || 0;
    } catch (error) {
      console.error('❌ Erro ao obter sheetId:', error);
      return 0;
    }
  }

  async copySpreadsheetFromTemplate(templateSpreadsheetId: string, title?: string, userEmail?: string): Promise<CreatedSpreadsheet> {
    try {
      const finalTitle = title || 'Cópia de Planilha';
      console.log('📄 Copiando planilha do template:', templateSpreadsheetId);

      const copyResponse = await this.drive.files.copy({
        fileId: templateSpreadsheetId,
        resource: {
          name: finalTitle
        }
      });

      const spreadsheetId = copyResponse.data.id!;

      // Compartilhar com o email do usuário, se fornecido
      if (userEmail) {
        await this.shareSpreadsheet(spreadsheetId, userEmail, 'writer');
      }

      // Compartilhar automaticamente com o email do serviço Google (env ou fallback)
      const DEFAULT_SERVICE_EMAIL = 'apostas-bot-service@enxame-de-agentes-463217.iam.gserviceaccount.com';
      const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || DEFAULT_SERVICE_EMAIL;
      if (serviceEmail) {
        console.log('🔗 Compartilhando planilha copiada com o serviço Google:', serviceEmail);
        await this.shareSpreadsheet(spreadsheetId, serviceEmail, 'writer');
      }

      // Recuperar link webView e outros metadados
      const fileInfo = await this.drive.files.get({
        fileId: spreadsheetId,
        fields: 'id, name, webViewLink, createdTime'
      });

      return {
        id: spreadsheetId,
        name: fileInfo.data.name || finalTitle,
        url: fileInfo.data.webViewLink || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
        createdAt: new Date(fileInfo.data.createdTime || new Date().toISOString())
      };
    } catch (error) {
      console.error('❌ Erro ao copiar planilha do template:', error);
      throw error;
    }
  }
}

export default GoogleDriveService;
export type { DriveConfig, SpreadsheetTemplate, CreatedSpreadsheet };