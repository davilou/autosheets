import { NextRequest, NextResponse } from 'next/server';
import GoogleSheetsService from '@/lib/sheets/service';
import AuthService from '@/lib/auth/service';
import SpreadsheetManager from '@/lib/spreadsheets/manager';

const authService = new AuthService();
const spreadsheetManager = new SpreadsheetManager();

// Middleware de autenticação
async function authenticate(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  const result = await authService.verifyToken(token);
  
  return result.success ? result.user : null;
}

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }
    
    // Buscar a planilha ativa do usuário
    const userSpreadsheetId = await spreadsheetManager.getUserActiveSpreadsheet(user.id);
    
    if (!userSpreadsheetId) {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'Usuário não possui planilha ativa'
      });
    }
    
    // Configurar o serviço do Google Sheets com a planilha do usuário
    const sheetsConfig = {
      spreadsheetId: userSpreadsheetId,
      range: 'Dados!A:M',
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL!,
        private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      },
    };
    
    const sheetsService = new GoogleSheetsService(sheetsConfig);
    const data = await sheetsService.getSheetData();
    
    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Erro ao buscar dados:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

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

    const { action, betData } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, message: 'Ação é obrigatória' },
        { status: 400 }
      );
    }

    // Nova ação: reaplicar validação em todas as planilhas ativas do usuário
    if (action === 'reapply-resultado-validation') {
      const result = await spreadsheetManager.reapplyResultadoValidationForUser(user.id);
      return NextResponse.json({ success: result.success, updated: result.updated, errors: result.errors });
    }

    const userSpreadsheetId = await spreadsheetManager.getUserActiveSpreadsheet(user.id);

    if (!userSpreadsheetId) {
      return NextResponse.json(
        { success: false, message: 'Planilha não configurada para este usuário' },
        { status: 404 }
      );
    }

    console.log('📊 Ação na planilha do usuário:', action);

    // Carregar serviço de planilha sob demanda
    const GoogleSheetsService = (await import('@/lib/sheets/service')).default;

    const sheetsService = new GoogleSheetsService({
      spreadsheetId: userSpreadsheetId,
      range: 'Dados!A:M',
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL!,
        private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      },
    });

    // Processar ações
    if (action === 'append') {
      const success = await sheetsService.addBetData(betData);
      return NextResponse.json({ success, message: success ? 'Dados adicionados com sucesso' : 'Falha ao adicionar dados' });
    }

    if (action === 'update-odd') {
      const { betId, oddReal, stake } = betData || {};
      if (!betId) {
        return NextResponse.json(
          { success: false, message: 'betId é obrigatório para update-odd' },
          { status: 400 }
        );
      }
      const success = await sheetsService.updateBetOddByBetId(betId, oddReal ?? null, stake);
      return NextResponse.json({ success, message: success ? 'Odd atualizada com sucesso' : 'Falha ao atualizar odd' });
    }

    if (action === 'update-result') {
      const { rowNumber, resultado } = betData || {};
      if (!rowNumber || !resultado) {
        return NextResponse.json(
          { success: false, message: 'rowNumber e resultado são obrigatórios para update-result' },
          { status: 400 }
        );
      }
      const success = await sheetsService.updateResultado(rowNumber, resultado);
      return NextResponse.json({ success, message: success ? 'Resultado atualizado' : 'Falha ao atualizar resultado' });
    }

    return NextResponse.json(
      { success: false, message: 'Ação inválida' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Erro ao processar ação na planilha:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}