import { NextRequest, NextResponse } from 'next/server';
import { telegramCredentialsService } from '@/lib/telegram/credentials-service';
import { TelegramStatus } from '@prisma/client';
import jwt from 'jsonwebtoken';

// Função para extrair o usuário do token JWT
function getUserFromToken(request: NextRequest): { userId: string } | null {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET não configurado');
    }

    const decoded = jwt.verify(token, secret) as any;
    return { userId: decoded.userId };
  } catch (error) {
    return null;
  }
}

/**
 * PATCH /api/telegram/credentials/[id]
 * Atualiza o status de uma credencial
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { status, lastError } = body;

    // Valida o status
    if (!status || !Object.values(TelegramStatus).includes(status)) {
      return NextResponse.json(
        { success: false, message: 'Status inválido' },
        { status: 400 }
      );
    }

    const { id } = await params;
    await telegramCredentialsService.updateStatus(
      id,
      user.userId,
      status,
      lastError
    );

    return NextResponse.json({
      success: true,
      message: 'Status atualizado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/telegram/credentials/[id]
 * Remove uma credencial (hard delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    const { id } = await params;
    await telegramCredentialsService.removeCredentials(id, user.userId);

    return NextResponse.json({
      success: true,
      message: 'Credencial removida com sucesso'
    });
  } catch (error) {
    console.error('Erro ao remover credencial:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/telegram/credentials/[id]
 * Obtém detalhes de uma credencial específica
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const credentials = await telegramCredentialsService.getUserCredentials(user.userId);
    const credential = credentials.find(c => c.id === id);

    if (!credential) {
      return NextResponse.json(
        { success: false, message: 'Credencial não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: credential
    });
  } catch (error) {
    console.error('Erro ao buscar credencial:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}