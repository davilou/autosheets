import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { google } from 'googleapis';

// POST - Testar credencial do Google Drive
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const resolvedParams = await params;
    const credentialId = resolvedParams.id;

    // Buscar a credencial
    const credential = await prisma.googleDriveCredential.findFirst({
      where: {
        id: credentialId,
        userId: user.id,
        isActive: true,
      },
    });

    if (!credential) {
      return NextResponse.json(
        { error: 'Credencial não encontrada' },
        { status: 404 }
      );
    }

    try {
      // Configurar OAuth2 client
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      // Se temos tokens, configurá-los
      if (credential.accessToken && credential.refreshToken) {
        oauth2Client.setCredentials({
          access_token: credential.accessToken,
          refresh_token: credential.refreshToken,
        });

        // Testar acesso ao Google Drive
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        await drive.about.get({ fields: 'user' });

        // Atualizar status para conectado
        await prisma.googleDriveCredential.update({
          where: { id: credentialId },
          data: {
            status: 'CONNECTED',
            lastConnected: new Date(),
            lastError: null,
          },
        });

        return NextResponse.json({ 
          message: 'Credencial testada com sucesso',
          status: 'CONNECTED'
        });
      } else {
        // Gerar URL de autorização
        const authUrl = oauth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: [
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/spreadsheets',
          ],
          state: credentialId, // Passar o ID da credencial no state
        });

        // Atualizar status para desconectado
        await prisma.googleDriveCredential.update({
          where: { id: credentialId },
          data: {
            status: 'DISCONNECTED',
            lastError: 'Autorização necessária',
          },
        });

        return NextResponse.json({
          message: 'Autorização necessária',
          authUrl: authUrl,
          status: 'DISCONNECTED'
        });
      }
    } catch (error: any) {
      console.error('Erro ao testar credencial:', error);
      
      // Atualizar status para erro
      await prisma.googleDriveCredential.update({
        where: { id: credentialId },
        data: {
          status: 'ERROR',
          lastError: error.message || 'Erro desconhecido',
        },
      });

      return NextResponse.json(
        { 
          error: 'Erro ao testar credencial',
          details: error.message,
          status: 'ERROR'
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Erro interno ao testar credencial:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}