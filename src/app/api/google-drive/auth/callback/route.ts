import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { google } from 'googleapis';

// GET - Callback do OAuth do Google
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // ID da credencial
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        new URL(`/google-drive?error=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/google-drive?error=missing_parameters', request.url)
      );
    }

    // Buscar a credencial
    const credential = await prisma.googleDriveCredential.findUnique({
      where: { id: state },
    });

    if (!credential) {
      return NextResponse.redirect(
        new URL('/google-drive?error=credential_not_found', request.url)
      );
    }

    try {
      // Configurar OAuth2 client
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      // Trocar código por tokens
      const { tokens } = await oauth2Client.getToken(code);
      
      // Configurar tokens
      oauth2Client.setCredentials(tokens);

      // Testar acesso ao Google Drive
      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      const userInfo = await drive.about.get({ fields: 'user' });

      // Atualizar credencial com tokens
      await prisma.googleDriveCredential.update({
        where: { id: state },
        data: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          scope: tokens.scope,
          status: 'CONNECTED',
          lastConnected: new Date(),
          lastError: null,
        },
      });

      return NextResponse.redirect(
        new URL('/google-drive?success=authorized', request.url)
      );
    } catch (error: any) {
      console.error('Erro ao processar autorização:', error);
      
      // Atualizar status para erro
      await prisma.googleDriveCredential.update({
        where: { id: state },
        data: {
          status: 'ERROR',
          lastError: error.message || 'Erro na autorização',
        },
      });

      return NextResponse.redirect(
        new URL(`/google-drive?error=${encodeURIComponent(error.message)}`, request.url)
      );
    }
  } catch (error) {
    console.error('Erro interno no callback:', error);
    return NextResponse.redirect(
      new URL('/google-drive?error=internal_error', request.url)
    );
  }
}