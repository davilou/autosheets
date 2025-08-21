import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { google } from 'googleapis';

// GET /api/internal/master-drive/start
// Protegido por header x-internal-auth. Retorna a URL de autorização do Google OAuth2
export async function GET(request: NextRequest) {
  try {
    const internalSecret = process.env.INTERNAL_MASTER_SETUP_SECRET;
    if (!internalSecret) {
      return NextResponse.json({ error: 'INTERNAL_MASTER_SETUP_SECRET não configurado' }, { status: 500 });
    }

    const authHeader = request.headers.get('x-internal-auth');
    if (!authHeader || authHeader !== internalSecret) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'Credenciais do Google não configuradas (GOOGLE_CLIENT_ID/SECRET)' }, { status: 500 });
    }

    // Monta redirect URI deste fluxo interno (precisa estar autorizado no console do Google)
    const origin = new URL(request.url).origin;
    const redirectUri = `${origin}/api/internal/master-drive/callback`;

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    // Cria um state assinado para proteção CSRF
    const jwtSecret = process.env.JWT_SECRET || 'your-super-secret-key';
    const state = jwt.sign({ purpose: 'master_setup' }, jwtSecret, { expiresIn: '10m' });

    const scopes = [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/spreadsheets',
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes,
      include_granted_scopes: true,
      state,
    });

    return NextResponse.json({ authUrl, redirectUri });
  } catch (error: any) {
    console.error('Erro ao gerar URL de autorização da conta mestre:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}