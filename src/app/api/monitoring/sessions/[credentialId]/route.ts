import { NextRequest, NextResponse } from 'next/server';
import AuthService from '@/lib/auth/service';
import MonitorManager from '@/lib/telegram/monitor-manager';
import { prisma } from '@/lib/db';

const authService = new AuthService();
const monitorManager = MonitorManager.getInstance();

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

// DELETE /api/monitoring/sessions/[credentialId] - Parar sessão de monitoramento
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ credentialId: string }> }
) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { credentialId } = await params;

    // Verificar se a credencial pertence ao usuário
    const credential = await prisma.telegramCredential.findFirst({
      where: {
        id: credentialId,
        userId: user.id
      }
    });

    if (!credential) {
      return NextResponse.json(
        { error: 'Credencial não encontrada' },
        { status: 404 }
      );
    }

    await monitorManager.initialize();

    const result = await monitorManager.stopUserMonitoring(
      user.id,
      credentialId
    );

    if (result.success) {
      return NextResponse.json({ message: result.message });
    } else {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Erro ao parar sessão:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PATCH /api/monitoring/sessions/[credentialId] - Reiniciar sessão de monitoramento
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ credentialId: string }> }
) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { credentialId } = await params;
    const body = await request.json();
    const { action } = body;

    if (action !== 'restart') {
      return NextResponse.json(
        { error: 'Ação não suportada' },
        { status: 400 }
      );
    }

    // Verificar se a credencial pertence ao usuário
    const credential = await prisma.telegramCredential.findFirst({
      where: {
        id: credentialId,
        userId: user.id
      }
    });

    if (!credential) {
      return NextResponse.json(
        { error: 'Credencial não encontrada' },
        { status: 404 }
      );
    }

    await monitorManager.initialize();

    const result = await monitorManager.restartUserMonitoring(
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
    console.error('Erro ao reiniciar sessão:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}