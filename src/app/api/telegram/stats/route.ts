import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import AuthService from '@/lib/auth/service';

const prisma = new PrismaClient();
const authService = new AuthService();

// Função para autenticar usuário
async function authenticate(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return null;
    
    const result = await authService.verifyToken(token);
    if (!result.success || !result.user) return null;
    
    return result.user;
  } catch (error) {
    console.error('Erro na autenticação:', error);
    return null;
  }
}

// GET /api/telegram/stats - Obter estatísticas do dashboard do Telegram
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Buscar credenciais ativas e inativas
    const [activeCredentials, inactiveCredentials, activeSessions] = await Promise.all([
      // Credenciais ativas
      prisma.telegramCredential.count({
        where: {
          userId: user.id,
          isActive: true
        }
      }),
      
      // Credenciais inativas
      prisma.telegramCredential.count({
        where: {
          userId: user.id,
          isActive: false
        }
      }),
      
      // Sessões ativas
      prisma.telegramSession.count({
        where: {
          credential: {
            userId: user.id
          },
          isActive: true
        }
      })
    ]);

    // Buscar grupos monitorados ativos
    const activeGroups = await prisma.monitoredGroup.count({
      where: {
        userId: user.id,
        isActive: true
      }
    });

    // Buscar estatísticas de mensagens processadas (últimas 24h)
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const messagesProcessed = await prisma.bet.count({
      where: {
        userId: user.id,
        createdAt: {
          gte: last24h
        }
      }
    });

    // Buscar últimas atividades
    const recentActivity = await prisma.telegramSession.findMany({
      where: {
        credential: {
          userId: user.id
        },
        lastUsed: {
          gte: last24h
        }
      },
      include: {
        credential: {
          select: {
            sessionName: true,
            phoneNumber: true
          }
        }
      },
      orderBy: {
        lastUsed: 'desc'
      },
      take: 5
    });

    const stats = {
      credentials: {
        active: activeCredentials,
        inactive: inactiveCredentials,
        total: activeCredentials + inactiveCredentials
      },
      sessions: {
        active: activeSessions
      },
      groups: {
        monitored: activeGroups
      },
      activity: {
        messagesProcessed24h: messagesProcessed,
        recentSessions: recentActivity.map(session => ({
          sessionName: session.credential.sessionName,
          phoneNumber: session.credential.phoneNumber,
          lastUsed: session.lastUsed,
          isActive: session.isActive
        }))
      }
    };

    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Erro ao buscar estatísticas do Telegram:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}