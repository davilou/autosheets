import { TelegramSession } from '@prisma/client';
import { encrypt, decrypt } from '@/lib/security/encryption';
import { prisma } from '@/lib/db';

export interface SessionData {
  sessionString: string;
  metadata?: Record<string, any>;
}

export interface ConnectionLog {
  timestamp: Date;
  event: 'connect' | 'disconnect' | 'error' | 'reconnect';
  message: string;
  details?: Record<string, any>;
}

export interface TelegramSessionResponse {
  id: string;
  credentialId: string;
  isActive: boolean;
  lastUsed: Date;
  connectionLogs: ConnectionLog[];
  hasBackup: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class TelegramSessionService {
  /**
   * Cria uma nova sessão do Telegram
   */
  async createSession(
    credentialId: string,
    userId: string,
    sessionData: SessionData
  ): Promise<TelegramSessionResponse> {
    try {
      // Criptografa os dados da sessão
      const encryptedSessionData = encrypt(JSON.stringify(sessionData), userId);
      
      // Cria o log inicial
      const initialLog: ConnectionLog = {
        timestamp: new Date(),
        event: 'connect',
        message: 'Sessão criada com sucesso'
      };

      const session = await prisma.telegramSession.create({
        data: {
          credentialId,
          sessionData: encryptedSessionData,
          connectionLogs: JSON.stringify([initialLog]),
          isActive: true,
          lastUsed: new Date()
        }
      });

      return this.formatSessionResponse(session);
    } catch (error) {
      throw new Error(`Erro ao criar sessão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Obtém uma sessão ativa
   */
  async getActiveSession(
    credentialId: string,
    userId: string
  ): Promise<{ session: TelegramSessionResponse; sessionData: SessionData } | null> {
    try {
      const session = await prisma.telegramSession.findFirst({
        where: {
          credentialId,
          isActive: true
        },
        orderBy: {
          lastUsed: 'desc'
        }
      });

      if (!session) {
        return null;
      }

      // Descriptografa os dados da sessão
      const decryptedData = decrypt(session.sessionData, userId);
      const sessionData: SessionData = JSON.parse(decryptedData);

      // Atualiza o lastUsed
      await this.updateLastUsed(session.id);

      return {
        session: this.formatSessionResponse(session),
        sessionData
      };
    } catch (error) {
      throw new Error(`Erro ao obter sessão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Atualiza os dados de uma sessão
   */
  async updateSession(
    sessionId: string,
    userId: string,
    sessionData: SessionData
  ): Promise<void> {
    try {
      const encryptedSessionData = encrypt(JSON.stringify(sessionData), userId);
      
      await prisma.telegramSession.update({
        where: { id: sessionId },
        data: {
          sessionData: encryptedSessionData,
          lastUsed: new Date()
        }
      });
    } catch (error) {
      throw new Error(`Erro ao atualizar sessão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Adiciona um log de conexão
   */
  async addConnectionLog(
    sessionId: string,
    log: ConnectionLog
  ): Promise<void> {
    try {
      const session = await prisma.telegramSession.findUnique({
        where: { id: sessionId }
      });

      if (!session) {
        throw new Error('Sessão não encontrada');
      }

      const existingLogs: ConnectionLog[] = session.connectionLogs 
        ? JSON.parse(session.connectionLogs)
        : [];
      
      existingLogs.push(log);
      
      // Mantém apenas os últimos 100 logs
      const recentLogs = existingLogs.slice(-100);

      await prisma.telegramSession.update({
        where: { id: sessionId },
        data: {
          connectionLogs: JSON.stringify(recentLogs),
          lastUsed: new Date()
        }
      });
    } catch (error) {
      throw new Error(`Erro ao adicionar log: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Cria backup de uma sessão
   */
  async createBackup(
    sessionId: string,
    userId: string,
    sessionData: SessionData
  ): Promise<void> {
    try {
      const backupData = {
        ...sessionData,
        backupTimestamp: new Date().toISOString()
      };
      
      const encryptedBackup = encrypt(JSON.stringify(backupData), userId);
      
      await prisma.telegramSession.update({
        where: { id: sessionId },
        data: {
          backupData: encryptedBackup
        }
      });

      await this.addConnectionLog(sessionId, {
        timestamp: new Date(),
        event: 'connect',
        message: 'Backup da sessão criado'
      });
    } catch (error) {
      throw new Error(`Erro ao criar backup: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Restaura uma sessão do backup
   */
  async restoreFromBackup(
    sessionId: string,
    userId: string
  ): Promise<SessionData | null> {
    try {
      const session = await prisma.telegramSession.findUnique({
        where: { id: sessionId }
      });

      if (!session || !session.backupData) {
        return null;
      }

      const decryptedBackup = decrypt(session.backupData, userId);
      const backupData = JSON.parse(decryptedBackup);
      
      // Remove o timestamp do backup
      const { backupTimestamp, ...sessionData } = backupData;

      await this.addConnectionLog(sessionId, {
        timestamp: new Date(),
        event: 'connect',
        message: `Sessão restaurada do backup de ${backupTimestamp}`
      });

      return sessionData;
    } catch (error) {
      throw new Error(`Erro ao restaurar backup: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Desativa uma sessão
   */
  async deactivateSession(sessionId: string): Promise<void> {
    try {
      await prisma.telegramSession.update({
        where: { id: sessionId },
        data: {
          isActive: false
        }
      });

      await this.addConnectionLog(sessionId, {
        timestamp: new Date(),
        event: 'disconnect',
        message: 'Sessão desativada'
      });
    } catch (error) {
      throw new Error(`Erro ao desativar sessão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Lista todas as sessões de uma credencial
   */
  async getCredentialSessions(credentialId: string): Promise<TelegramSessionResponse[]> {
    try {
      const sessions = await prisma.telegramSession.findMany({
        where: { credentialId },
        orderBy: { lastUsed: 'desc' }
      });

      return sessions.map(session => this.formatSessionResponse(session));
    } catch (error) {
      throw new Error(`Erro ao listar sessões: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Atualiza o timestamp de último uso
   */
  private async updateLastUsed(sessionId: string): Promise<void> {
    await prisma.telegramSession.update({
      where: { id: sessionId },
      data: { lastUsed: new Date() }
    });
  }

  /**
   * Formata a resposta da sessão
   */
  private formatSessionResponse(session: TelegramSession): TelegramSessionResponse {
    const connectionLogs: ConnectionLog[] = session.connectionLogs 
      ? JSON.parse(session.connectionLogs)
      : [];

    return {
      id: session.id,
      credentialId: session.credentialId,
      isActive: session.isActive,
      lastUsed: session.lastUsed,
      connectionLogs,
      hasBackup: !!session.backupData,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    };
  }
}

export const telegramSessionService = new TelegramSessionService();