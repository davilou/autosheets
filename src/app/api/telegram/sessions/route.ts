import { NextRequest, NextResponse } from 'next/server';
import { telegramSessionService } from '@/lib/telegram/session-service';
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
 * GET /api/telegram/sessions?credentialId=xxx
 * Lista todas as sessões de uma credencial
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const credentialId = searchParams.get('credentialId');

    if (!credentialId) {
      return NextResponse.json(
        { success: false, message: 'credentialId é obrigatório' },
        { status: 400 }
      );
    }

    const sessions = await telegramSessionService.getCredentialSessions(credentialId);
    
    return NextResponse.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    console.error('Erro ao buscar sessões:', error);
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
 * POST /api/telegram/sessions
 * Cria uma nova sessão
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { credentialId, sessionData } = body;

    if (!credentialId || !sessionData) {
      return NextResponse.json(
        { success: false, message: 'credentialId e sessionData são obrigatórios' },
        { status: 400 }
      );
    }

    const session = await telegramSessionService.createSession(
      credentialId,
      user.userId,
      sessionData
    );

    return NextResponse.json({
      success: true,
      message: 'Sessão criada com sucesso',
      data: session
    });
  } catch (error) {
    console.error('Erro ao criar sessão:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}