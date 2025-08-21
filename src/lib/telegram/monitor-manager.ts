import MultiUserTelegramMonitor from './multi-user-monitor';
import { EventEmitter } from 'events';
import { prisma } from '@/lib/db';

interface MonitorManagerConfig {
  maxConcurrentSessions: number;
  sessionTimeoutMs: number;
  queueProcessIntervalMs: number;
  heartbeatIntervalMs: number;
  autoRestartFailedSessions: boolean;
}

class MonitorManager extends EventEmitter {
  private static instance: MonitorManager;
  private monitor: MultiUserTelegramMonitor;
  private config: MonitorManagerConfig;
  private isInitialized = false;
  private cleanupInterval?: NodeJS.Timeout;

  private constructor() {
    super();
    this.monitor = new MultiUserTelegramMonitor();
    this.config = {
      maxConcurrentSessions: 50,
      sessionTimeoutMs: 300000, // 5 minutos
      queueProcessIntervalMs: 5000,
      heartbeatIntervalMs: 60000,
      autoRestartFailedSessions: false
    };
    
    this.setupEventHandlers();
  }

  static getInstance(): MonitorManager {
    if (!MonitorManager.instance) {
      MonitorManager.instance = new MonitorManager();
    }
    return MonitorManager.instance;
  }

  // Verifica se está rodando no contexto do script monitor ou no servidor Next.js
  private isMonitorContext(): boolean {
    // Verifica se está sendo executado pelo script de monitoramento
    const isMainModule = require.main?.filename?.includes('start-multi-user-monitor');
    const hasMonitorEnv = process.env.MONITOR_CONTEXT === 'true';
    const isNodeScript = process.argv[1]?.includes('start-multi-user-monitor');
    
    return Boolean(isMainModule || hasMonitorEnv || isNodeScript);
  }

  // Inicializar o gerenciador
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('📊 Monitor Manager já inicializado');
      return;
    }

    try {
      console.log('🚀 Inicializando Monitor Manager...');
      
      // Só recuperar sessões ativas se estivermos no contexto do monitor
      if (this.isMonitorContext()) {
        console.log('🔄 Contexto de monitor detectado - recuperando sessões ativas');
        await this.recoverActiveSessions();
      } else {
        console.log('📡 Contexto de servidor web detectado - inicialização sem sessões');
      }
      
      // Iniciar limpeza automática apenas no contexto do monitor
      if (this.isMonitorContext()) {
        this.startCleanupRoutine();
      }
      
      this.isInitialized = true;
      console.log('✅ Monitor Manager inicializado com sucesso');
      
      this.emit('initialized');
    } catch (error) {
      console.error('❌ Erro ao inicializar Monitor Manager:', error);
      throw error;
    }
  }

  // Recuperar sessões ativas do banco de dados
  private async recoverActiveSessions(): Promise<void> {
    try {
      const activeSessions = await prisma.userMonitorSession.findMany({
        where: {
          isActive: true,
          lastHeartbeat: {
            gte: new Date(Date.now() - this.config.sessionTimeoutMs)
          }
        },
        include: {
          user: true,
          credential: {
            include: {
              monitoredGroups: {
                where: { isActive: true }
              }
            }
          }
        }
      });

      console.log(`🔄 Recuperando ${activeSessions.length} sessões ativas...`);

      for (const session of activeSessions) {
        try {
          if (session.credential.monitoredGroups.length > 0) {
            await this.monitor.startUserMonitoring(session.userId, session.credentialId);
            console.log(`✅ Sessão recuperada: ${session.userId}`);
          } else {
            // Desativar sessão sem grupos monitorados
            await prisma.userMonitorSession.update({
              where: { id: session.id },
              data: { isActive: false }
            });
          }
        } catch (error) {
          console.error(`❌ Erro ao recuperar sessão ${session.userId}:`, error);
          
          // Marcar sessão como inativa em caso de erro
          await prisma.userMonitorSession.update({
            where: { id: session.id },
            data: { isActive: false }
          });
        }
      }
    } catch (error) {
      console.error('❌ Erro ao recuperar sessões ativas:', error);
    }
  }

  // Iniciar monitoramento para um usuário
  async startUserMonitoring(userId: string, credentialId: string): Promise<{
    success: boolean;
    message: string;
    sessionId?: string;
  }> {
    // Impede inicialização via servidor web/Next.js
    if (!this.isMonitorContext()) {
      return {
        success: false,
        message: 'Operação permitida apenas no processo de monitor. Inicie o monitor com: npm run monitor'
      };
    }
    try {
      // Verificar se o usuário tem grupos monitorados
      const monitoredGroups = await prisma.monitoredGroup.count({
        where: {
          credentialId,
          isActive: true
        }
      });

      if (monitoredGroups === 0) {
        return {
          success: false,
          message: 'Nenhum grupo monitorado ativo encontrado'
        };
      }

      // Verificar limite de sessões concorrentes
      const activeSessions = await prisma.userMonitorSession.count({
        where: { isActive: true }
      });

      if (activeSessions >= this.config.maxConcurrentSessions) {
        return {
          success: false,
          message: 'Limite máximo de sessões concorrentes atingido'
        };
      }

      // Iniciar monitoramento
      const success = await this.monitor.startUserMonitoring(userId, credentialId);
      
      if (success) {
        const session = await prisma.userMonitorSession.findFirst({
          where: {
            userId,
            credentialId,
            isActive: true
          }
        });

        this.emit('userMonitoringStarted', { userId, credentialId });
        
        return {
          success: true,
          message: 'Monitoramento iniciado com sucesso',
          sessionId: session?.sessionId
        };
      } else {
        return {
          success: false,
          message: 'Falha ao iniciar monitoramento'
        };
      }
    } catch (error) {
      console.error(`❌ Erro ao iniciar monitoramento para ${userId}:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  // Parar monitoramento para um usuário
  async stopUserMonitoring(userId: string, credentialId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    // Impede parada via servidor web/Next.js
    if (!this.isMonitorContext()) {
      return {
        success: false,
        message: 'Operação permitida apenas no processo de monitor. Inicie o monitor com: npm run monitor'
      };
    }
    try {
      const success = await this.monitor.stopUserMonitoring(userId, credentialId);
      
      if (success) {
        this.emit('userMonitoringStopped', { userId, credentialId });
        return {
          success: true,
          message: 'Monitoramento parado com sucesso'
        };
      } else {
        return {
          success: false,
          message: 'Falha ao parar monitoramento'
        };
      }
    } catch (error) {
      console.error(`❌ Erro ao parar monitoramento para ${userId}:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  // Reiniciar monitoramento para um usuário
  async restartUserMonitoring(userId: string, credentialId: string): Promise<{
    success: boolean;
    message: string;
    sessionId?: string;
  }> {
    try {
      console.log(`🔄 Solicitado reinício de monitoramento para usuário ${userId}`);
      
      // Apenas solicita o reinício. O processo de monitor fará o trabalho pesado.
      await prisma.userMonitorSession.updateMany({
        where: {
          userId,
          credentialId,
          isActive: true
        },
        data: {
          restartRequested: true
        }
      });

      this.emit('userMonitoringRestartRequested', { userId, credentialId });
      
      return {
        success: true,
        message: 'Solicitação de reinício enviada com sucesso'
      };
    } catch (error) {
      console.error(`❌ Erro ao solicitar reinício de monitoramento para ${userId}:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  // Obter status de todas as sessões
  async getSessionsStatus(): Promise<any[]> {
    try {
      const sessions = await prisma.userMonitorSession.findMany({
        where: { isActive: true },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          },
          credential: {
            select: {
              id: true,
              phoneNumber: true,
              isActive: true
            }
          }
        },
        orderBy: { lastHeartbeat: 'desc' }
      });

      return sessions.map(session => ({
        id: session.id,
        userId: session.userId,
        userName: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || session.user.email,
        credentialId: session.credentialId,
        phoneNumber: session.credential.phoneNumber,
        sessionId: session.sessionId,
        isActive: session.isActive,
        lastHeartbeat: session.lastHeartbeat,
        processedMessages: session.processedMessages,
        errorCount: session.errorCount,
        uptime: Date.now() - session.startedAt.getTime(),
        isHealthy: Date.now() - session.lastHeartbeat.getTime() < this.config.sessionTimeoutMs
      }));
    } catch (error) {
      console.error('❌ Erro ao obter status das sessões:', error);
      return [];
    }
  }

  // Obter estatísticas gerais
  async getGeneralStats(): Promise<any> {
    try {
      const [activeSessions, totalGroups, queueStats, recentBets] = await Promise.all([
        prisma.userMonitorSession.count({ where: { isActive: true } }),
        prisma.monitoredGroup.count({ where: { isActive: true } }),
        prisma.monitorQueue.groupBy({
          by: ['status'],
          _count: { status: true }
        }),
        prisma.bet.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Últimas 24h
            }
          }
        })
      ]);

      const queueByStatus = queueStats.reduce((acc, stat) => {
        acc[stat.status] = stat._count.status;
        return acc;
      }, {} as Record<string, number>);

      return {
        activeSessions,
        totalGroups,
        queueStats: queueByStatus,
        recentBets,
        performanceMetrics: this.monitor.getPerformanceMetrics(),
        timestamp: new Date()
      };
    } catch (error) {
      console.error('❌ Erro ao obter estatísticas gerais:', error);
      return null;
    }
  }

  // Configurar event handlers
  private setupEventHandlers(): void {
    this.monitor.on('userSessionStarted', (data) => {
      console.log(`✅ Sessão iniciada: ${data.userId}`);
      this.emit('sessionStarted', data);
    });

    this.monitor.on('userSessionStopped', (data) => {
      console.log(`🛑 Sessão parada: ${data.userId}`);
      this.emit('sessionStopped', data);
    });

    this.monitor.on('userSessionError', async (data) => {
      console.error(`❌ Erro na sessão: ${data.userId}`, data.error);
      this.emit('sessionError', data);
      
      // Auto-restart se configurado
      if (this.config.autoRestartFailedSessions) {
        setTimeout(async () => {
          console.log(`🔄 Tentando reiniciar sessão: ${data.userId}`);
          await this.restartUserMonitoring(data.userId, data.credentialId);
        }, 30000); // Aguardar 30 segundos antes de reiniciar
      }
    });

    this.monitor.on('sessionUnhealthy', async (data) => {
      console.warn(`⚠️ Sessão não saudável: ${data.sessionKey}`);
      this.emit('sessionUnhealthy', data);
    });

    this.monitor.on('betDetected', (data) => {
      console.log(`🎯 Aposta detectada para usuário ${data.userId}`);
      this.emit('betDetected', data);
    });

    this.monitor.on('messageProcessingError', (data) => {
      console.error(`❌ Erro no processamento de mensagem: ${data.userId}`);
      this.emit('messageProcessingError', data);
    });
  }

  // Iniciar rotina de limpeza
  private startCleanupRoutine(): void {
    this.cleanupInterval = setInterval(async () => {
      try {
        // Limpar sessões expiradas
        await this.cleanupExpiredSessions();
        
        // Processar reinicializações solicitadas
        await this.processRestarts();

        // Limpar itens antigos da fila
        await this.cleanupOldQueueItems();
        
      } catch (error) {
        console.error('❌ Erro na rotina de limpeza:', error);
      }
    }, 10000); // A cada 10 segundos
  }

  // Limpar sessões expiradas
  private async cleanupExpiredSessions(): Promise<void> {
    const expiredSessions = await prisma.userMonitorSession.findMany({
      where: {
        isActive: true,
        lastHeartbeat: {
          lt: new Date(Date.now() - this.config.sessionTimeoutMs)
        }
      }
    });

    for (const session of expiredSessions) {
      console.log(`🧹 Limpando sessão expirada: ${session.userId}`);
      
      try {
        await this.monitor.stopUserMonitoring(session.userId, session.credentialId);
      } catch (error) {
        console.error(`Erro ao parar sessão expirada ${session.userId}:`, error);
      }

      // Tentar reiniciar automaticamente a sessão expirou, imitando a ação do botão "Reiniciar"
      try {
        // Pequeno delay para garantir que os recursos foram liberados
        await new Promise(resolve => setTimeout(resolve, 2000));

        const result = await this.startUserMonitoring(session.userId, session.credentialId);
        if (result.success) {
          console.log(`🔄 Sessão reiniciada automaticamente: ${session.userId}`);
        } else {
          console.warn(`⚠️ Falha ao reiniciar sessão expirada ${session.userId}: ${result.message}`);
        }
      } catch (error) {
        console.error(`❌ Erro ao reiniciar sessão expirada ${session.userId}:`, error);
      }
    }
  }

  private async processRestarts(): Promise<void> {
    const sessionsToRestart = await prisma.userMonitorSession.findMany({
      where: {
        isActive: true,
        restartRequested: true
      }
    });

    for (const session of sessionsToRestart) {
      console.log(`🔄 Processando reinício para sessão: ${session.sessionId}`);
      try {
        // Parar monitoramento atual
        await this.monitor.stopUserMonitoring(session.userId, session.credentialId);
        
        // Aguardar um pouco antes de reiniciar
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Iniciar novamente
        const result = await this.monitor.startUserMonitoring(session.userId, session.credentialId);
        
        if (result) {
          this.emit('userMonitoringRestarted', { userId: session.userId, credentialId: session.credentialId });
          // Resetar o flag
          await prisma.userMonitorSession.update({
            where: { id: session.id },
            data: { restartRequested: false }
          });
        }
      } catch (error) {
        console.error(`❌ Erro ao reiniciar monitoramento para ${session.userId}:`, error);
      }
    }
  }

  // Limpar itens antigos da fila
  private async cleanupOldQueueItems(): Promise<void> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const deletedCount = await prisma.monitorQueue.deleteMany({
      where: {
        OR: [
          {
            status: 'COMPLETED',
            createdAt: { lt: oneDayAgo }
          },
          {
            status: 'FAILED',
            createdAt: { lt: oneDayAgo }
          }
        ]
      }
    });

    if (deletedCount.count > 0) {
      console.log(`🧹 Removidos ${deletedCount.count} itens antigos da fila`);
    }
  }

  // Atualizar configuração
  updateConfig(newConfig: Partial<MonitorManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Configuração atualizada:', this.config);
    this.emit('configUpdated', this.config);
  }

  // Obter configuração atual
  getConfig(): MonitorManagerConfig {
    return { ...this.config };
  }

  // Obter métricas de performance
  getPerformanceMetrics(userId?: string): any {
    return this.monitor.getPerformanceMetrics(userId);
  }

  // Limpar recursos
  async cleanup(): Promise<void> {
    console.log('🧹 Limpando recursos do Monitor Manager...');
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    await this.monitor.cleanup();
    
    this.isInitialized = false;
    console.log('✅ Recursos limpos com sucesso');
  }
}

export default MonitorManager;
export type { MonitorManagerConfig };