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
 * POST /api/spreadsheets/[id]/backup
 * Cria um backup manual de uma planilha
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
    const { customName } = body;

    console.log(`💾 Criando backup da planilha ${spreadsheetId}`);

    const backupId = await spreadsheetManager.createSpreadsheetBackup(
      spreadsheetId,
      user.id,
      customName
    );

    if (!backupId) {
      return NextResponse.json(
        { success: false, message: 'Erro ao criar backup' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Backup criado com sucesso',
      data: {
        backupId,
        originalSpreadsheetId: spreadsheetId,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Erro ao criar backup:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/spreadsheets/[id]/backup
 * Configura backup automático para uma planilha
 */
export async function PUT(
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
    const { frequency, enabled } = body;

    // Validações
    if (enabled && !frequency) {
      return NextResponse.json(
        { success: false, message: 'Frequência é obrigatória quando backup automático está habilitado' },
        { status: 400 }
      );
    }

    if (frequency && !['daily', 'weekly', 'monthly'].includes(frequency)) {
      return NextResponse.json(
        { success: false, message: 'Frequência deve ser "daily", "weekly" ou "monthly"' },
        { status: 400 }
      );
    }

    if (enabled) {
      console.log(`⏰ Configurando backup automático para ${spreadsheetId}: ${frequency}`);
      
      const success = await spreadsheetManager.setupAutoBackup(spreadsheetId, frequency);
      
      if (!success) {
        return NextResponse.json(
          { success: false, message: 'Erro ao configurar backup automático' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Backup automático configurado para ${frequency}`,
        data: {
          enabled: true,
          frequency
        }
      });
    } else {
      console.log(`⏰ Desabilitando backup automático para ${spreadsheetId}`);
      
      return NextResponse.json({
        success: true,
        message: 'Backup automático desabilitado',
        data: {
          enabled: false,
          frequency: null
        }
      });
    }
  } catch (error) {
    console.error('Erro ao configurar backup automático:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}