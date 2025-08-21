import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { google } from 'googleapis';

// POST - Verificar planilhas compartilhadas
export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Buscar planilhas do usuário
    const userSpreadsheets = await prisma.userSpreadsheet.findMany({
      where: {
        userId: user.id,
        isActive: true,
      },
    });

    if (userSpreadsheets.length === 0) {
      return NextResponse.json({
        message: 'Nenhuma planilha encontrada para verificar',
        summary: {
          totalSpreadsheets: 0,
          verifiedSpreadsheets: 0,
          sharedSpreadsheets: 0,
          errorSpreadsheets: 0,
        },
        results: [],
      });
    }

    const verificationResults = [];

    // Usar credenciais do administrador (service account)
    try {
      // Verificar se as credenciais do administrador estão configuradas
      if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
        return NextResponse.json(
          { error: 'Credenciais do administrador não configuradas' },
          { status: 500 }
        );
      }

      // Configurar autenticação com service account
      const credentials = {
      type: 'service_account',
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/spreadsheets'
      ]
    });

    const authClient = await auth.getClient();

    const drive = google.drive({ version: 'v3', auth: authClient as any });
    const sheets = google.sheets({ version: 'v4', auth: authClient as any });

      // Verificar cada planilha
      for (const spreadsheet of userSpreadsheets) {
        try {
          // Verificar se a planilha existe
          const spreadsheetInfo = await sheets.spreadsheets.get({
            spreadsheetId: spreadsheet.spreadsheetId,
          });

          // Verificar permissões de compartilhamento
          const permissions = await drive.permissions.list({
            fileId: spreadsheet.spreadsheetId,
            fields: 'permissions(id,type,role,emailAddress)',
          });

          // Verificar se está compartilhada com o email do usuário
          const userEmail = spreadsheet.driveEmail || user.email;
          const isSharedCorrectly = permissions.data.permissions?.some(
            (permission) => 
              permission.emailAddress === userEmail &&
              (permission.role === 'writer' || permission.role === 'reader')
          );

          // Atualizar status da planilha
          await prisma.userSpreadsheet.update({
            where: { id: spreadsheet.id },
            data: {
              isShared: isSharedCorrectly || false,
            },
          });

          verificationResults.push({
            spreadsheetId: spreadsheet.spreadsheetId,
            name: spreadsheet.name,
            exists: true,
            isShared: isSharedCorrectly || false,
            driveEmail: userEmail,
            url: spreadsheet.url,
            status: 'verified',
          });
        } catch (error: any) {
          console.error(`Erro ao verificar planilha ${spreadsheet.spreadsheetId}:`, error);
          
          // Marcar planilha como não compartilhada se houver erro
          await prisma.userSpreadsheet.update({
            where: { id: spreadsheet.id },
            data: {
              isShared: false,
            },
          });

          verificationResults.push({
            spreadsheetId: spreadsheet.spreadsheetId,
            name: spreadsheet.name,
            exists: false,
            isShared: false,
            driveEmail: spreadsheet.driveEmail || user.email,
            url: spreadsheet.url,
            status: 'error',
            error: error.message,
          });
        }
      }
    } catch (error: any) {
      console.error('Erro ao configurar autenticação do administrador:', error);
      return NextResponse.json(
        { error: 'Erro na autenticação do administrador' },
        { status: 500 }
      );
    }

    const summary = {
      totalSpreadsheets: userSpreadsheets.length,
      verifiedSpreadsheets: verificationResults.filter(r => r.status === 'verified').length,
      sharedSpreadsheets: verificationResults.filter(r => r.isShared).length,
      errorSpreadsheets: verificationResults.filter(r => r.status === 'error').length,
    };

    return NextResponse.json({
      message: 'Verificação concluída',
      summary,
      results: verificationResults,
    });
  } catch (error) {
    console.error('Erro interno na verificação:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}