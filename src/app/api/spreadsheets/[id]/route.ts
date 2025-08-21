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
 * GET /api/spreadsheets/[id]
 * Obtém detalhes de uma planilha específica
 */
export async function GET(
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
    
    console.log('📊 Obtendo detalhes da planilha:', spreadsheetId);

    const details = await spreadsheetManager.getSpreadsheetDetails(spreadsheetId);
    
    if (!details) {
      return NextResponse.json(
        { success: false, message: 'Planilha não encontrada' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: details
    });
  } catch (error) {
    console.error('Erro ao obter detalhes da planilha:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/spreadsheets/[id]/reapply-validation
 * Reaplica a validação de dados na coluna Resultado da planilha
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

    // Instanciar serviço de Drive para acionar revalidação
    const SpreadsheetManagerClass = (await import('@/lib/spreadsheets/manager')).default;
    const manager = new SpreadsheetManagerClass();

    // Acesso indireto ao drive service para chamar reapplyResultadoValidation
    // Expor método via manager para manter encapsulamento seria o ideal, mas por agora chamamos direto
    const DriveServiceClass = (await import('@/lib/drive/service')).default;
    const driveService = new DriveServiceClass({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL!,
        private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }
    });
    await driveService.initialize();

    const success = await (driveService as any).reapplyResultadoValidation(spreadsheetId);

    if (!success) {
      return NextResponse.json(
        { success: false, message: 'Falha ao reaplicar validação' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Validação reaplicada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao reaplicar validação:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/spreadsheets/[id]
 * Desativa uma planilha (soft delete)
 */
export async function DELETE(
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
    
    console.log('🗑️ Desativando planilha:', spreadsheetId);

    const success = await spreadsheetManager.deactivateSpreadsheet(spreadsheetId, user.id);
    
    if (!success) {
      return NextResponse.json(
        { success: false, message: 'Erro ao desativar planilha' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Planilha desativada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao desativar planilha:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}