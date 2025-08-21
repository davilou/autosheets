import { TelegramCredential, TelegramStatus } from '@prisma/client';
import { encrypt, decrypt } from '@/lib/security/encryption';
import { validateTelegramCredentials } from './validation';
import SpreadsheetManager from '@/lib/spreadsheets/manager';
import { prisma } from '@/lib/db';

export interface TelegramCredentialData {
  apiId: string;
  apiHash: string;
  phoneNumber: string;
  sessionName: string;
  driveEmail: string;
}

export interface TelegramCredentialResponse {
  id: string;
  sessionName: string;
  phoneNumber: string; // Mascarado para segurança
  apiId: string; // Mascarado para segurança
  status: TelegramStatus;
  lastConnected?: Date;
  lastError?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class TelegramCredentialsService {
  /**
   * Adiciona novas credenciais do Telegram para um usuário
   * e cria automaticamente uma planilha padrão
   */
  async addCredentials(
    userId: string,
    credentials: TelegramCredentialData
  ): Promise<TelegramCredentialResponse> {
    try {
      // Valida as credenciais antes de salvar
      const isValid = await validateTelegramCredentials({
        apiId: credentials.apiId,
        apiHash: credentials.apiHash,
        phoneNumber: credentials.phoneNumber
      });

      if (!isValid) {
        throw new Error('Credenciais do Telegram inválidas');
      }

      // Verifica se já existe uma credencial com o mesmo sessionName
      const existing = await prisma.telegramCredential.findUnique({
        where: {
          userId_sessionName: {
            userId,
            sessionName: credentials.sessionName
          }
        }
      });

      if (existing) {
        throw new Error('Já existe uma sessão com este nome');
      }

      // Criptografa as credenciais sensíveis
      const encryptedApiId = encrypt(credentials.apiId, userId);
      const encryptedApiHash = encrypt(credentials.apiHash, userId);
      const encryptedPhoneNumber = encrypt(credentials.phoneNumber, userId);

      // Salva no banco de dados
      const savedCredential = await prisma.telegramCredential.create({
        data: {
          userId,
          apiId: encryptedApiId,
          apiHash: encryptedApiHash,
          phoneNumber: encryptedPhoneNumber,
          sessionName: credentials.sessionName,
          status: TelegramStatus.DISCONNECTED
        }
      });

      // Criar planilha automaticamente para o usuário
      try {
        console.log('📊 Criando planilha automática para usuário:', userId);
        
        // Buscar dados do usuário
        const user = await prisma.user.findUnique({
          where: { id: userId }
        });

        if (user) {
          const spreadsheetManager = new SpreadsheetManager();
          // Usar o email do usuário como fallback se driveEmail for undefined
          const driveEmail = credentials.driveEmail || user.email;
          const spreadsheet = await spreadsheetManager.createDefaultSpreadsheetForUser(
            userId,
            user.email,
            driveEmail
          );
          
          if (spreadsheet) {
            console.log('✅ Planilha criada automaticamente com sucesso');
          } else {
            console.log('⚠️ Planilha não pôde ser criada (Google Drive não configurado)');
          }
        }
      } catch (spreadsheetError) {
        console.error('⚠️ Erro ao criar planilha automática:', spreadsheetError);
        // Não falha a operação principal se a planilha não puder ser criada
      }

      return this.formatCredentialResponse(savedCredential, credentials.phoneNumber, credentials.apiId);
    } catch (error) {
      throw new Error(`Erro ao adicionar credenciais: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Lista todas as credenciais de um usuário
   */
  async getUserCredentials(userId: string, includeInactive: boolean = false): Promise<TelegramCredentialResponse[]> {
    try {
      const whereClause: any = {
        userId
      };

      // Se includeInactive for false, filtrar apenas as ativas
      if (!includeInactive) {
        whereClause.isActive = true;
      }

      const credentials = await prisma.telegramCredential.findMany({
        where: whereClause,
        orderBy: {
          createdAt: 'desc'
        }
      });

      return credentials.map(credential => {
        const phoneNumber = decrypt(credential.phoneNumber, userId);
        const apiId = decrypt(credential.apiId, userId);
        return this.formatCredentialResponse(credential, phoneNumber, apiId);
      });
    } catch (error) {
      throw new Error(`Erro ao buscar credenciais: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Obtém credenciais descriptografadas para uso interno
   */
  async getDecryptedCredentials(credentialId: string, userId: string): Promise<TelegramCredentialData | null> {
    try {
      const credential = await prisma.telegramCredential.findFirst({
        where: {
          id: credentialId,
          userId,
          isActive: true
        }
      });

      if (!credential) {
        return null;
      }

      return {
        apiId: decrypt(credential.apiId, userId),
        apiHash: decrypt(credential.apiHash, userId),
        phoneNumber: decrypt(credential.phoneNumber, userId),
        sessionName: credential.sessionName,
        driveEmail: ''
      };
    } catch (error) {
      throw new Error(`Erro ao descriptografar credenciais: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Atualiza o status de uma credencial
   */
  async updateStatus(
    credentialId: string,
    userId: string,
    status: TelegramStatus,
    lastError?: string
  ): Promise<void> {
    try {
      await prisma.telegramCredential.updateMany({
        where: {
          id: credentialId,
          userId
        },
        data: {
          status,
          lastConnected: status === TelegramStatus.CONNECTED ? new Date() : undefined,
          lastError: lastError || null
        }
      });
    } catch (error) {
      throw new Error(`Erro ao atualizar status: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Remove credenciais (hard delete)
   */
  async removeCredentials(credentialId: string, userId: string): Promise<void> {
    try {
      await prisma.telegramCredential.deleteMany({
        where: {
          id: credentialId,
          userId
        }
      });
    } catch (error) {
      throw new Error(`Erro ao remover credenciais: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Formata a resposta das credenciais para o frontend
   */
  private formatCredentialResponse(
    credential: TelegramCredential,
    phoneNumber: string,
    apiId: string
  ): TelegramCredentialResponse {
    return {
      id: credential.id,
      sessionName: credential.sessionName,
      phoneNumber: this.maskPhoneNumber(phoneNumber),
      apiId: this.maskApiId(apiId),
      status: credential.status,
      lastConnected: credential.lastConnected || undefined,
      lastError: credential.lastError || undefined,
      isActive: credential.isActive,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt
    };
  }

  /**
   * Mascara o número de telefone para exibição
   */
  private maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length <= 4) {
      return phoneNumber;
    }
    const start = phoneNumber.slice(0, 2);
    const end = phoneNumber.slice(-2);
    const middle = '*'.repeat(phoneNumber.length - 4);
    return start + middle + end;
  }

  /**
   * Mascara o API ID para exibição
   */
  private maskApiId(apiId: string): string {
    if (apiId.length <= 4) {
      return apiId;
    }
    const start = apiId.substring(0, 2);
    const end = apiId.substring(apiId.length - 2);
    const middle = '*'.repeat(apiId.length - 4);
    return start + middle + end;
  }
}

export const telegramCredentialsService = new TelegramCredentialsService();