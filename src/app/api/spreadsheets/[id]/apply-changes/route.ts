import { NextRequest, NextResponse } from 'next/server';
import AuthService from '@/lib/auth/service';
import GoogleDriveService from '@/lib/drive/service';
import GoogleSheetsService from '@/lib/sheets/service';
import { BETTING_TEMPLATES } from '@/lib/spreadsheets/templates';
import { prisma } from '@/lib/db';

const authService = new AuthService();

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
 * POST /api/spreadsheets/[id]/apply-changes
 * Aplica todas as alterações estruturais na planilha existente:
 * - Atualiza cabeçalhos para incluir nova coluna 'Grupo'
 * - Reaplica validação da coluna 'Resultado' 
 * - Configura formatação adequada
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
    // Permitir que o parâmetro seja tanto o ID da tabela (UserSpreadsheet.id) quanto o ID do Google Sheets (spreadsheetId)
    let spreadsheetId = id;
    try {
      const record = await prisma.userSpreadsheet.findFirst({
        where: { id, userId: user.id, isActive: true },
        select: { spreadsheetId: true },
      });
      if (record?.spreadsheetId) {
        spreadsheetId = record.spreadsheetId;
      }
    } catch (e) {
      console.warn('Aviso: falha ao resolver UserSpreadsheet por id, utilizando parâmetro diretamente como spreadsheetId');
    }

    console.log('🔄 Aplicando alterações na planilha:', { paramId: id, resolvedSpreadsheetId: spreadsheetId });

    // Configurar DriveService para formatação e validação
    const driveService = new GoogleDriveService({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL!,
        private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }
    });
    await driveService.initialize();

    // Configurar SheetsService para atualizações de conteúdo
    const sheetsService = new GoogleSheetsService({
      spreadsheetId,
      range: 'Dados!A:M',
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL!,
        private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }
    });

    const results = {
      headersUpdated: false,
      validationApplied: false,
      formattingApplied: false,
      errors: [] as string[]
    };

    try {
      // 1. Atualizar cabeçalhos com nova estrutura (13 colunas)
      console.log('📝 Atualizando cabeçalhos...');
      const headersUpdated = await sheetsService.createHeaderRow();
      results.headersUpdated = headersUpdated;
      
      if (!headersUpdated) {
        results.errors.push('Falha ao atualizar cabeçalhos');
      }
    } catch (error) {
      console.error('Erro ao atualizar cabeçalhos:', error);
      results.errors.push('Erro ao atualizar cabeçalhos: ' + (error as Error).message);
    }

    try {
      // 2. Reaplicar validação na coluna Resultado (coluna M)
      console.log('✅ Reaplicando validação...');
      const validationApplied = await (driveService as any).reapplyResultadoValidation(spreadsheetId);
      results.validationApplied = validationApplied;
      
      if (!validationApplied) {
        results.errors.push('Falha ao reaplicar validação');
      }
    } catch (error) {
      console.error('Erro ao reaplicar validação:', error);
      results.errors.push('Erro ao reaplicar validação: ' + (error as Error).message);
    }

    try {
      // 3. Aplicar formatação dos cabeçalhos
      console.log('🎨 Aplicando formatação...');
      
      // Obter sheetId da aba 'Dados'
      const sheetId = await (driveService as any).getSheetId(spreadsheetId, 'Dados');
      const formattingApplied = await (driveService as any).formatHeaders(spreadsheetId, sheetId);
      results.formattingApplied = formattingApplied !== false;
      
      if (formattingApplied === false) {
        results.errors.push('Falha ao aplicar formatação');
      }
    } catch (error) {
      console.error('Erro ao aplicar formatação:', error);
      results.errors.push('Erro ao aplicar formatação: ' + (error as Error).message);
    }

    // Determinar sucesso geral
    const successCount = [results.headersUpdated, results.validationApplied, results.formattingApplied]
      .filter(Boolean).length;
    const totalOperations = 3;
    
    const isSuccess = successCount >= 2; // Pelo menos 2 de 3 operações devem ter sucesso

    console.log(`✅ Alterações aplicadas: ${successCount}/${totalOperations} operações bem-sucedidas`);

    return NextResponse.json({
      success: isSuccess,
      message: isSuccess 
        ? `Alterações aplicadas com sucesso (${successCount}/${totalOperations} operações)` 
        : `Falha ao aplicar algumas alterações (${successCount}/${totalOperations} operações)`,
      data: {
        ...results,
        summary: {
          total: totalOperations,
          successful: successCount,
          failed: totalOperations - successCount
        }
      }
    });

  } catch (error) {
    console.error('Erro ao aplicar alterações:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Erro interno do servidor ao aplicar alterações',
        error: (error as Error).message 
      },
      { status: 500 }
    );
  }
}