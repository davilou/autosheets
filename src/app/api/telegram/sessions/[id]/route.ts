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
 * PATCH /api/telegram/sessions/[id]
 * Atualiza uma sessão ou executa ações específicas
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

    const { id } = await params;
    const body = await request.json();
    const { action, sessionData } = body;

    switch (action) {
      case 'update':
        if (!sessionData) {
          return NextResponse.json(
            { success: false, message: 'sessionData é obrigatório para atualização' },
            { status: 400 }
          );
        }
        
        await telegramSessionService.updateSession(
          id,
          user.userId,
          sessionData
        );
        
        return NextResponse.json({
          success: true,
          message: 'Sessão atualizada com sucesso'
        });

      case 'backup':
        if (!sessionData) {
          return NextResponse.json(
            { success: false, message: 'sessionData é obrigatório para backup' },
            { status: 400 }
          );
        }
        
        await telegramSessionService.createBackup(
          id,
          user.userId,
          sessionData
        );
        
        return NextResponse.json({
          success: true,
          message: 'Backup criado com sucesso'
        });

      case 'restore':
        const restoredData = await telegramSessionService.restoreFromBackup(
          id,
          user.userId
        );
        
        if (!restoredData) {
          return NextResponse.json(
            { success: false, message: 'Nenhum backup encontrado' },
            { status: 404 }
          );
        }
        
        return NextResponse.json({
          success: true,
          message: 'Sessão restaurada do backup',
          data: restoredData
        });

      case 'deactivate':
        await telegramSessionService.deactivateSession(id);
        
        return NextResponse.json({
          success: true,
          message: 'Sessão desativada com sucesso'
        });

      case 'log':
        const { event, message, details } = body;
        
        if (!event || !message) {
          return NextResponse.json(
            { success: false, message: 'event e message são obrigatórios para log' },
            { status: 400 }
          );
        }
        
        await telegramSessionService.addConnectionLog(id, {
          timestamp: new Date(),
          event,
          message,
          details
        });
        
        return NextResponse.json({
          success: true,
          message: 'Log adicionado com sucesso'
        });

      default:
        return NextResponse.json(
          { success: false, message: 'Ação inválida' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Erro ao processar ação da sessão:', error);
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
 * GET /api/telegram/sessions/[id]
 * Obtém uma sessão ativa com seus dados
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

    // Para obter uma sessão específica, precisamos do credentialId
    // Por segurança, não retornamos os dados da sessão diretamente
    // Apenas informações básicas
    
    return NextResponse.json({
      success: true,
      message: 'Use a API de credenciais para obter sessões ativas'
    });
  } catch (error) {
    console.error('Erro ao buscar sessão:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}