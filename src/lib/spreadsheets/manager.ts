import GoogleDriveService, { CreatedSpreadsheet, SpreadsheetTemplate } from '../drive/service';
import TemplateManager, { BETTING_TEMPLATES, ColumnConfig } from './templates';
import { prisma } from '@/lib/db';

interface UserSpreadsheet {
  id: string;
  userId: string;
  spreadsheetId: string;
  name: string;
  templateType: string;
  url: string;
  driveEmail: string | null;
  isActive: boolean;
  isShared: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastBackup?: Date;
  sharedWith?: string[];
}

interface SpreadsheetConfig {
  templateType: keyof typeof BETTING_TEMPLATES | 'custom' | 'clone_by_id';
  customColumns?: ColumnConfig[];
  title?: string;
  shareWithEmails?: string[];
  autoBackup?: boolean;
  backupFrequency?: 'daily' | 'weekly' | 'monthly';
  templateSpreadsheetId?: string; // when cloning from an existing spreadsheet
}

class SpreadsheetManager {
  private driveService: GoogleDriveService | null = null;

  constructor() {
    const accessToken = process.env.MASTER_GOOGLE_ACCESS_TOKEN;
    const refreshToken = process.env.MASTER_GOOGLE_REFRESH_TOKEN;

    try {
      if (accessToken && refreshToken) {
        this.driveService = new GoogleDriveService({
          oauth: {
            access_token: accessToken,
            refresh_token: refreshToken,
          },
        });
        // initialize Google Drive Service asynchronously (master account)
        (async () => {
          try {
            await this.driveService!.initialize();
          } catch (initErr) {
            console.error('⚠️ Erro ao inicializar Google Drive Service (conta mestre):', initErr);
            this.driveService = null;
          }
        })();
      } else {
        console.warn('⚠️ Tokens OAuth2 da conta mestre não configurados (MASTER_GOOGLE_ACCESS_TOKEN/MASTER_GOOGLE_REFRESH_TOKEN).');
        this.driveService = null;
      }
    } catch (error) {
      console.error('⚠️ Erro ao criar instância do Google Drive Service (conta mestre):', error);
      // Continua sem o serviço do Drive - será tratado nos métodos
    }
  }

  /**
   * Cria uma nova planilha para o usuário
   */
  async createUserSpreadsheet(
    userId: string,
    userEmail: string,
    driveEmail: string,
    config: SpreadsheetConfig
  ): Promise<UserSpreadsheet | null> {
    try {
      console.log('📊 Criando planilha para usuário:', userId);

      // Autenticação via conta mestre (OAuth2)
      let driveService: GoogleDriveService | null = this.driveService;
      if (!driveService) {
        const accessToken = process.env.MASTER_GOOGLE_ACCESS_TOKEN;
        const refreshToken = process.env.MASTER_GOOGLE_REFRESH_TOKEN;
        if (accessToken && refreshToken) {
          driveService = new GoogleDriveService({
            oauth: {
              access_token: accessToken,
              refresh_token: refreshToken,
            },
          });
          try {
            await driveService.initialize();
            this.driveService = driveService;
            console.log('✅ Usando conta mestre (OAuth2) para criar a planilha');
          } catch (credErr) {
            console.error('❌ Erro ao inicializar conta mestre do Google Drive:', credErr);
            return null;
          }
        } else {
          console.error('❌ Tokens OAuth2 da conta mestre não configurados. Defina MASTER_GOOGLE_ACCESS_TOKEN e MASTER_GOOGLE_REFRESH_TOKEN.');
          return null;
        }
      } else {
        console.log('✅ Usando conta mestre (OAuth2) para criar a planilha');
      }

      // Novo fluxo: clonar por ID de planilha existente
      if (config.templateType === 'clone_by_id') {
        if (!config.templateSpreadsheetId) {
          throw new Error('templateSpreadsheetId é obrigatório quando templateType = clone_by_id');
        }

        const copied = await driveService.copySpreadsheetFromTemplate(
          config.templateSpreadsheetId,
          config.title,
          userEmail
        );

        // Compartilhar com o email do Drive do usuário
        await driveService.shareSpreadsheet(copied.id, driveEmail, 'writer');

        // Compartilhar com emails adicionais
        if (config.shareWithEmails && config.shareWithEmails.length > 0) {
          for (const email of config.shareWithEmails) {
            await driveService.shareSpreadsheet(copied.id, email, 'writer');
          }
        }

        // Salvar no banco
        const savedSpreadsheet = await prisma.userSpreadsheet.create({
          data: {
            userId,
            spreadsheetId: copied.id,
            name: copied.name,
            templateType: 'clone_by_id',
            url: copied.url,
            driveEmail,
            isActive: true,
            isShared: true,
            autoBackup: config.autoBackup || false,
            backupFrequency: config.backupFrequency || null
          }
        });

        const userSpreadsheet: UserSpreadsheet = {
          id: savedSpreadsheet.id,
          userId: savedSpreadsheet.userId,
          spreadsheetId: savedSpreadsheet.spreadsheetId,
          name: savedSpreadsheet.name,
          templateType: savedSpreadsheet.templateType,
          url: savedSpreadsheet.url,
          driveEmail: savedSpreadsheet.driveEmail,
          isActive: savedSpreadsheet.isActive,
          isShared: savedSpreadsheet.isShared,
          createdAt: savedSpreadsheet.createdAt,
          updatedAt: savedSpreadsheet.updatedAt
        } as UserSpreadsheet;

        return userSpreadsheet;
      }

      // (Demais tipos de template podem ser implementados aqui, se necessário)
      throw new Error('TemplateType não suportado. Use clone_by_id.');

    } catch (error) {
      console.error('❌ Erro ao criar planilha:', error);
      return null;
    }
  }

  /**
   * Lista todas as planilhas do usuário
   */
  async getUserSpreadsheets(userId: string): Promise<UserSpreadsheet[]> {
    try {
      const spreadsheets = await prisma.userSpreadsheet.findMany({
        where: {
          userId,
          isActive: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      return spreadsheets.map(sheet => ({
        id: sheet.id,
        userId: sheet.userId,
        spreadsheetId: sheet.spreadsheetId,
        name: sheet.name,
        templateType: sheet.templateType,
        url: sheet.url,
        driveEmail: sheet.driveEmail,
        isActive: sheet.isActive,
        isShared: sheet.isShared,
        createdAt: sheet.createdAt,
        updatedAt: sheet.updatedAt
      }));

    } catch (error) {
      console.error('❌ Erro ao listar planilhas do usuário:', error);
      return [];
    }
  }

  /**
   * Obtém informações detalhadas de uma planilha
   */
  async getSpreadsheetDetails(spreadsheetId: string): Promise<any> {
    try {
      if (!this.driveService) {
        throw new Error('Google Drive Service não está disponível');
      }
      return await this.driveService.getSpreadsheetInfo(spreadsheetId);
    } catch (error) {
      console.error('Erro ao obter detalhes da planilha:', error);
      return null;
    }
  }

  /**
   * Compartilha uma planilha com outros usuários
   */
  async shareSpreadsheet(
    spreadsheetId: string,
    emails: string[],
    role: 'reader' | 'writer' = 'writer'
  ): Promise<boolean> {
    try {
      // Adicionar automaticamente o email do serviço Google se não estiver na lista
      const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      const emailsToShare = [...emails];
      
      if (serviceEmail && !emailsToShare.includes(serviceEmail)) {
        emailsToShare.push(serviceEmail);
        console.log('🔗 Adicionando email do serviço Google à lista de compartilhamento:', serviceEmail);
      }

      console.log(`🔗 Compartilhando planilha ${spreadsheetId} com ${emailsToShare.length} usuários`);

      for (const email of emailsToShare) {
        if (!this.driveService) {
          throw new Error('Google Drive Service não está disponível');
        }
        const success = await this.driveService.shareSpreadsheet(
          spreadsheetId,
          email,
          role
        );
        
        if (!success) {
          console.warn(`⚠️ Falha ao compartilhar com ${email}`);
        }
      }

      return true;
    } catch (error) {
      console.error('❌ Erro ao compartilhar planilha:', error);
      return false;
    }
  }

  /**
   * Cria backup de uma planilha
   */
  async createSpreadsheetBackup(
    spreadsheetId: string,
    userId: string,
    customName?: string
  ): Promise<string | null> {
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const backupName = customName || `Backup_${timestamp}_${spreadsheetId.substring(0, 8)}`;

      if (!this.driveService) {
        throw new Error('Google Drive Service não está disponível');
      }
      const backupId = await this.driveService.createBackup(spreadsheetId, backupName);
      
      if (backupId) {
        // TODO: Atualizar registro no banco com data do último backup
        console.log('✅ Backup criado com sucesso:', backupId);
      }

      return backupId;
    } catch (error) {
      console.error('❌ Erro ao criar backup:', error);
      return null;
    }
  }

  /**
   * Configura backup automático para uma planilha
   */
  async setupAutoBackup(
    spreadsheetId: string,
    frequency: 'daily' | 'weekly' | 'monthly'
  ): Promise<boolean> {
    try {
      // TODO: Implementar sistema de agendamento de backups
      // Por enquanto, apenas log da configuração
      console.log(`⏰ Backup automático configurado para ${spreadsheetId}: ${frequency}`);
      
      return true;
    } catch (error) {
      console.error('❌ Erro ao configurar backup automático:', error);
      return false;
    }
  }

  /**
   * Desativa uma planilha (soft delete)
   */
  async deactivateSpreadsheet(spreadsheetId: string, userId: string): Promise<boolean> {
    try {
      // TODO: Atualizar no banco para isActive = false
      console.log(`🗑️ Planilha ${spreadsheetId} desativada para usuário ${userId}`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao desativar planilha:', error);
      return false;
    }
  }

  /**
   * Obtém estatísticas das planilhas do usuário
   */
  async getUserSpreadsheetStats(userId: string): Promise<any> {
    try {
      const spreadsheets = await this.getUserSpreadsheets(userId);
      
      const stats = {
        total: spreadsheets.length,
        active: spreadsheets.filter(s => s.isActive).length,
        byTemplate: {} as Record<string, number>,
        oldestCreated: null as Date | null,
        newestCreated: null as Date | null,
        totalShared: 0
      };

      spreadsheets.forEach(sheet => {
        // Contar por template
        stats.byTemplate[sheet.templateType] = (stats.byTemplate[sheet.templateType] || 0) + 1;
        
        // Encontrar datas extremas
        if (!stats.oldestCreated || sheet.createdAt < stats.oldestCreated) {
          stats.oldestCreated = sheet.createdAt;
        }
        if (!stats.newestCreated || sheet.createdAt > stats.newestCreated) {
          stats.newestCreated = sheet.createdAt;
        }
        
        // Contar compartilhamentos
        if (sheet.sharedWith && sheet.sharedWith.length > 0) {
          stats.totalShared += sheet.sharedWith.length;
        }
      });

      return stats;
    } catch (error) {
      console.error('❌ Erro ao obter estatísticas:', error);
      return null;
    }
  }

  /**
   * Testa a conexão com os serviços
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.driveService) {
        return false;
      }
      return await this.driveService.testConnection();
    } catch (error) {
      console.error('Erro ao testar conexão:', error);
      return false;
    }
  }

  /**
   * Cria automaticamente uma planilha padrão para um novo usuário
   */
  async createDefaultSpreadsheetForUser(
    userId: string,
    userEmail: string,
    driveEmail: string
  ): Promise<UserSpreadsheet | null> {
    try {
      console.log('📊 Criando planilha padrão para usuário:', userId);

      // Verificar se o usuário já tem uma planilha
      const existingSpreadsheets = await prisma.userSpreadsheet.findMany({
        where: {
          userId,
          isActive: true
        }
      });

      if (existingSpreadsheets.length > 0) {
        console.log('✅ Usuário já possui planilha ativa');
        return existingSpreadsheets[0] as UserSpreadsheet;
      }

      // Configuração padrão para primeira planilha: sempre clonar por ID fixo
      const defaultConfig: SpreadsheetConfig = {
        templateType: 'clone_by_id',
        templateSpreadsheetId: '1hTipRbl9CS7ELz_P2h_g_PYi_mqXMpM53i_npLmwRS8',
        title: `Apostas - ${userEmail}`,
        autoBackup: false
      };

      return await this.createUserSpreadsheet(
        userId,
        userEmail,
        driveEmail,
        defaultConfig
      );

    } catch (error) {
      console.error('❌ Erro ao criar planilha padrão:', error);
      return null;
    }
  }

  /**
   * Obtém a planilha ativa do usuário (para salvar apostas)
   */
  async getUserActiveSpreadsheet(userId: string): Promise<string | null> {
    try {
      const spreadsheet = await prisma.userSpreadsheet.findFirst({
        where: {
          userId,
          isActive: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return spreadsheet?.spreadsheetId || null;
    } catch (error) {
      console.error('❌ Erro ao buscar planilha ativa:', error);
      return null;
    }
  }

  /**
   * Reaplica a validação da coluna Resultado (L) para todas as planilhas ativas do usuário
   */
  async reapplyResultadoValidationForUser(userId: string): Promise<{ success: boolean; updated: number; errors: string[] }> {
    const errors: string[] = [];
    let updated = 0;

    try {
      if (!this.driveService) {
        throw new Error('Google Drive Service não está disponível');
      }

      const sheets = await prisma.userSpreadsheet.findMany({
        where: { userId, isActive: true },
        orderBy: { createdAt: 'desc' }
      });

      for (const s of sheets) {
        try {
          const ok = await (this.driveService as any).reapplyResultadoValidation(s.spreadsheetId);
          if (ok) updated += 1; else errors.push(`Falha em ${s.spreadsheetId}`);
        } catch (e: any) {
          errors.push(`Erro em ${s.spreadsheetId}: ${e?.message || e}`);
        }
      }

      return { success: errors.length === 0, updated, errors };
    } catch (error: any) {
      errors.push(error?.message || 'Erro inesperado');
      return { success: false, updated, errors };
    }
  }
}

export default SpreadsheetManager;
export type { UserSpreadsheet, SpreadsheetConfig };