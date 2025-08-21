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

// GET /api/monitoring/sessions - Listar sessões de monitoramento
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const includeStats = searchParams.get('includeStats') === 'true';

    const monitorManager = MonitorManager.getInstance();
    await monitorManager.initialize();

    // Se userId for especificado, filtrar apenas para esse usuário
    const allSessions = await monitorManager.getSessionsStatus();
    const sessions = userId 
      ? allSessions.filter(s => s.userId === userId)
      : allSessions;

    let response: any = { sessions };

    if (includeStats) {
      const stats = await monitorManager.getGeneralStats();
      response.stats = stats;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Erro ao listar sessões:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST /api/monitoring/sessions - Iniciar nova sessão de monitoramento
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { credentialId } = body;

    if (!credentialId) {
      return NextResponse.json(
        { error: 'credentialId é obrigatório' },
        { status: 400 }
      );
    }

    const monitorManager = MonitorManager.getInstance();
    await monitorManager.initialize();

    const result = await monitorManager.startUserMonitoring(
      user.id,
      credentialId
    );

    if (result.success) {
      return NextResponse.json({
        message: result.message,
        sessionId: result.sessionId
      });
    } else {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Erro ao iniciar sessão:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}