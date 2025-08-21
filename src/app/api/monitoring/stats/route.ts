import { NextRequest, NextResponse } from 'next/server';
import AuthService from '@/lib/auth/service';
import MonitorManager from '@/lib/telegram/monitor-manager';
import { prisma } from '@/lib/db';

const authService = new AuthService();

// Middleware de autenticação
async function authenticate(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const result = await authService.verifyToken(token);
    return result.success ? result.user : null;
  } catch (error) {
    console.error('Erro na autenticação:', error);
    return null;
  }
}

// GET /api/monitoring/stats - Obter estatísticas do sistema de monitoramento
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const timeRange = searchParams.get('timeRange') || '24h';
    const includeDetails = searchParams.get('includeDetails') === 'true';

    const monitorManager = MonitorManager.getInstance();
    await monitorManager.initialize();

    // Calcular período baseado no timeRange
    const timeRanges: Record<string, number> = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };

    const periodMs = timeRanges[timeRange] || timeRanges['24h'];
    const startDate = new Date(Date.now() - periodMs);

    // Estatísticas gerais
    const generalStats = await monitorManager.getGeneralStats();

    // Se userId for fornecido, filtrar por usuário
    if (userId && userId !== user.id) {
      // Verificar se o usuário atual é admin para ver stats de outros usuários
      if (user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
      }
    }

    // Estatísticas específicas do usuário (se solicitado)
    let userStats = null;
    if (userId) {
      const userPerformance = monitorManager.getPerformanceMetrics(userId);
      
      const userBets = await prisma.bet.count({
        where: {
          userId,
          createdAt: { gte: startDate }
        }
      });

      const userGroups = await prisma.monitoredGroup.count({
        where: {
          credential: { userId },
          isActive: true
        }
      });

      // Corrigir a contagem de sessões do usuário usando o banco de dados (sessões ativas)
      const userActiveSessions = await prisma.userMonitorSession.count({
        where: {
          userId,
          isActive: true
        }
      });

      userStats = {
        ...userPerformance,
        // Garantir que userSessions represente a contagem real no banco
        userSessions: userActiveSessions,
        betsDetected: userBets,
        activeGroups: userGroups
      };
    }

    // Estatísticas detalhadas (se solicitado)
    let detailedStats = null;
    if (includeDetails) {
      const [hourlyBets, topGroups, errorStats, queueStats] = await Promise.all([
        // Apostas por hora
        prisma.bet.groupBy({
          by: ['createdAt'],
          where: {
            createdAt: { gte: startDate },
            ...(userId && { userId })
          },
          _count: { id: true }
        }),
        
        // Grupos mais ativos
        prisma.monitoredGroup.findMany({
          where: {
            isActive: true,
            ...(userId && { credential: { userId } }),
            lastActivity: { gte: startDate }
          },
          select: {
            id: true,
            chatTitle: true,
            messageCount: true,
            betCount: true,
            lastActivity: true
          },
          orderBy: { messageCount: 'desc' },
          take: 10
        }),
        
        // Estatísticas de erro
        prisma.userMonitorSession.groupBy({
          by: ['errorCount'],
          where: {
            ...(userId && { userId }),
            lastHeartbeat: { gte: startDate }
          },
          _sum: { errorCount: true },
          _avg: { errorCount: true }
        }),
        
        // Estatísticas da fila
        prisma.monitorQueue.groupBy({
          by: ['status'],
          where: {
            ...(userId && { userId }),
            createdAt: { gte: startDate }
          },
          _count: { status: true },
          _avg: { attempts: true }
        })
      ]);

      // Processar dados por hora
      const hourlyData = new Map<string, number>();
      hourlyBets.forEach(bet => {
        const hour = new Date(bet.createdAt).toISOString().slice(0, 13);
        hourlyData.set(hour, (hourlyData.get(hour) || 0) + bet._count.id);
      });

      detailedStats = {
        hourlyBets: Array.from(hourlyData.entries()).map(([hour, count]) => ({
          hour,
          count
        })),
        topGroups,
        errorStats: {
          totalErrors: errorStats.reduce((sum, stat) => sum + (stat._sum.errorCount || 0), 0),
          averageErrors: errorStats.reduce((sum, stat) => sum + (stat._avg.errorCount || 0), 0) / Math.max(errorStats.length, 1)
        },
        queueStats: queueStats.reduce((acc, stat) => {
          acc[stat.status] = {
            count: stat._count.status,
            averageAttempts: stat._avg.attempts || 0
          };
          return acc;
        }, {} as Record<string, any>)
      };
    }

    // Métricas de performance em tempo real
    const realtimeMetrics = {
      timestamp: new Date(),
      uptime: process.uptime() * 1000,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    };

    return NextResponse.json({
      general: generalStats,
      user: userStats,
      detailed: detailedStats,
      realtime: realtimeMetrics,
      timeRange,
      period: {
        start: startDate,
        end: new Date()
      }
    });
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST /api/monitoring/stats/reset - Resetar estatísticas (apenas admin)
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Verificar se o usuário é admin
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado - apenas administradores' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { resetType } = body;

    switch (resetType) {
      case 'queue':
        // Limpar fila de processamento
        await prisma.monitorQueue.deleteMany({
          where: {
            status: { in: ['COMPLETED', 'FAILED'] }
          }
        });
        break;
        
      case 'errors':
        // Resetar contadores de erro
        await prisma.userMonitorSession.updateMany({
          data: {
            errorCount: 0
          }
        });
        break;
        
      case 'counters':
        // Resetar contadores de mensagens e apostas
        await Promise.all([
          prisma.userMonitorSession.updateMany({
            data: {
              processedMessages: 0
            }
          }),
          prisma.monitoredGroup.updateMany({
            data: {
              messageCount: 0,
              betCount: 0
            }
          })
        ]);
        break;
      
      case 'all':
        // Resetar tudo
        await Promise.all([
          prisma.monitorQueue.deleteMany({
            where: {
              status: { in: ['COMPLETED', 'FAILED'] }
            }
          }),
          prisma.userMonitorSession.updateMany({
            data: {
              errorCount: 0,
              processedMessages: 0
            }
          }),
          prisma.monitoredGroup.updateMany({
            data: {
              messageCount: 0,
              betCount: 0
            }
          })
        ]);
        break;
      
      default:
        return NextResponse.json({ error: 'Tipo de reset inválido' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao resetar estatísticas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}