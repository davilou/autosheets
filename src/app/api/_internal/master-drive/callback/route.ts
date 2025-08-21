import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { google } from 'googleapis';

// GET /api/_internal/master-drive/callback
// Troca code por tokens e retorna os tokens para configuração da conta mestre
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.json({ error: `Erro do Google OAuth: ${error}` }, { status: 400 });
    }

    if (!code || !state) {
      return NextResponse.json({ error: 'Parâmetros ausentes (code/state)' }, { status: 400 });
    }

    // Verifica state
    const jwtSecret = process.env.JWT_SECRET || 'your-super-secret-key';
    try {
      const decoded: any = jwt.verify(state, jwtSecret);
      if (!decoded || decoded.purpose !== 'master_setup') {
        return NextResponse.json({ error: 'State inválido' }, { status: 400 });
      }
    } catch (e) {
      return NextResponse.json({ error: 'State inválido ou expirado' }, { status: 400 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'Credenciais do Google não configuradas (GOOGLE_CLIENT_ID/SECRET)' }, { status: 500 });
    }

    const origin = new URL(request.url).origin;
    const redirectUri = `${origin}/api/_internal/master-drive/callback`;

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    // Troca código por tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Testa a conta chamando Drive API
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const about = await drive.about.get({ fields: 'user(emailAddress,displayName)' });

    const payload = {
      message: 'Tokens gerados com sucesso. Configure-os nas variáveis de ambiente da conta mestre.',
      account: about.data.user,
      envSample: {
        MASTER_GOOGLE_ACCESS_TOKEN: tokens.access_token || '<access_token>',
        MASTER_GOOGLE_REFRESH_TOKEN: tokens.refresh_token || '<refresh_token>',
      },
      raw: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        scope: tokens.scope,
        expiry_date: tokens.expiry_date,
        token_type: tokens.token_type,
      },
    };

    // Observação: não persistimos em banco por segurança; cabe ao admin copiar e colar no .env
    return NextResponse.json(payload, { status: 200 });
  } catch (error: any) {
    console.error('Erro no callback da conta mestre:', error?.response?.data || error);
    const msg = error?.response?.data?.error || error?.message || 'Erro interno do servidor';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}