import { NextRequest, NextResponse } from 'next/server';
import SpreadsheetManager from '@/lib/spreadsheets/manager';
import AuthService from '@/lib/auth/service';

const authService = new AuthService();
const spreadsheetManager = new SpreadsheetManager();

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

/**
 * POST /api/spreadsheets/[id]/share
 * Compartilha uma planilha com outros usuários
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const spreadsheetId = id;
    const body = await request.json();
    const { emails, role = 'writer' } = body;

    // Validações
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Lista de emails é obrigatória' },
        { status: 400 }
      );
    }

    // Validar formato dos emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter(email => !emailRegex.test(email));
    
    if (invalidEmails.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: `Emails inválidos: ${invalidEmails.join(', ')}` 
        },
        { status: 400 }
      );
    }

    // Validar role
    if (!['reader', 'writer'].includes(role)) {
      return NextResponse.json(
        { success: false, message: 'Role deve ser "reader" ou "writer"' },
        { status: 400 }
      );
    }

    console.log(`🔗 Compartilhando planilha ${spreadsheetId} com:`, emails);

    const success = await spreadsheetManager.shareSpreadsheet(
      spreadsheetId,
      emails,
      role
    );

    if (!success) {
      return NextResponse.json(
        { success: false, message: 'Erro ao compartilhar planilha' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Planilha compartilhada com ${emails.length} usuário(s)`,
      data: {
        sharedWith: emails,
        role
      }
    });
  } catch (error) {
    console.error('Erro ao compartilhar planilha:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}