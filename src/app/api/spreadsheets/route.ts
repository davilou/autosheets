import { NextRequest, NextResponse } from 'next/server';
import SpreadsheetManager, { SpreadsheetConfig } from '@/lib/spreadsheets/manager';
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
 * GET /api/spreadsheets
 * Lista todas as planilhas do usuário
 */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    console.log('📊 Listando planilhas para usuário:', user.id);

    const spreadsheets = await spreadsheetManager.getUserSpreadsheets(user.id);
    const _rawStats = await spreadsheetManager.getUserSpreadsheetStats(user.id);

    // Map to expected SpreadsheetStats shape used by the frontend
    const computedStats = {
      totalSpreadsheets: spreadsheets.length,
      activeSpreadsheets: spreadsheets.filter(s => s.isActive).length,
      totalBackups: 0,
      storageUsed: 0,
      lastActivity: spreadsheets.length
        ? new Date(Math.max(...spreadsheets.map(s => new Date(s.updatedAt).getTime())))
        : new Date(0)
    };
    
    return NextResponse.json({
      success: true,
      data: {
        spreadsheets,
        stats: computedStats,
        total: spreadsheets.length
      }
    });
  } catch (error) {
    console.error('Erro ao listar planilhas:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/spreadsheets
 * Cria uma nova planilha para o usuário
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { driveEmail, ...config }: { driveEmail: string } & SpreadsheetConfig = body;

    // Validações básicas
    if (!config.templateType) {
      return NextResponse.json(
        { success: false, message: 'Tipo de template é obrigatório' },
        { status: 400 }
      );
    }

    if (!driveEmail) {
      return NextResponse.json(
        { success: false, message: 'Email do Google Drive é obrigatório' },
        { status: 400 }
      );
    }

    // Validar formato do email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(driveEmail)) {
      return NextResponse.json(
        { success: false, message: 'Email do Google Drive inválido' },
        { status: 400 }
      );
    }

    if (config.templateType === 'custom' && !config.customColumns) {
      return NextResponse.json(
        { success: false, message: 'Colunas personalizadas são obrigatórias para template customizado' },
        { status: 400 }
      );
    }

    console.log('📊 Criando planilha para usuário:', user.id, 'Template:', config.templateType);

    const spreadsheet = await spreadsheetManager.createUserSpreadsheet(
      user.id,
      user.email,
      driveEmail,
      config
    );

    if (!spreadsheet) {
      return NextResponse.json(
        { success: false, message: 'Erro ao criar planilha (verifique a configuração da conta mestre do Google Drive).' },
        { status: 500 }
      );
    }

    console.log('✅ Planilha criada com sucesso:', spreadsheet.id);

    return NextResponse.json({
      success: true,
      data: spreadsheet,
      message: 'Planilha criada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao criar planilha:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}