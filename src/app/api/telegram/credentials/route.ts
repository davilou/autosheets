import { NextRequest, NextResponse } from 'next/server';
import { telegramCredentialsService } from '@/lib/telegram/credentials-service';
import { validateCredentialsFormat, validateSessionName, normalizePhoneNumber } from '@/lib/telegram/validation';
import jwt from 'jsonwebtoken';

// Função para extrair o usuário do token JWT
function getUserFromToken(request: NextRequest): { userId: string } | null {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET não configurado');
    }

    const decoded = jwt.verify(token, secret) as any;
    return { userId: decoded.userId };
  } catch (error) {
    return null;
  }
}

/**
 * GET /api/telegram/credentials
 * Lista todas as credenciais do usuário
 * Query params:
 *   - includeInactive: boolean (opcional) - incluir credenciais inativas
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    // Verificar se deve incluir credenciais inativas
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const credentials = await telegramCredentialsService.getUserCredentials(user.userId, includeInactive);
    
    return NextResponse.json({
      success: true,
      data: credentials
    });
  } catch (error) {
    console.error('Erro ao buscar credenciais:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/telegram/credentials
 * Adiciona novas credenciais do Telegram
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { apiId, apiHash, phoneNumber, sessionName, driveEmail } = body;

    // Validações básicas
    if (!apiId || !apiHash || !phoneNumber || !sessionName || !driveEmail) {
      return NextResponse.json(
        { success: false, message: 'Todos os campos são obrigatórios (incluindo email do Google Drive)' },
        { status: 400 }
      );
    }

    // Validar formato do email do Drive
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(driveEmail)) {
      return NextResponse.json(
        { success: false, message: 'Email do Google Drive inválido' },
        { status: 400 }
      );
    }

    // Valida o nome da sessão
    const sessionValidation = validateSessionName(sessionName);
    if (!sessionValidation.isValid) {
      return NextResponse.json(
        { success: false, message: sessionValidation.error },
        { status: 400 }
      );
    }

    // Normaliza o número de telefone
    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    // Valida o formato das credenciais
    const credentialsValidation = validateCredentialsFormat({
      apiId,
      apiHash,
      phoneNumber: normalizedPhone
    });

    if (!credentialsValidation.isValid) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Credenciais inválidas',
          errors: credentialsValidation.errors
        },
        { status: 400 }
      );
    }

    // Adiciona as credenciais
    const credential = await telegramCredentialsService.addCredentials(user.userId, {
      apiId,
      apiHash,
      phoneNumber: normalizedPhone,
      sessionName,
      driveEmail
    });

    return NextResponse.json({
      success: true,
      message: 'Credenciais adicionadas com sucesso',
      data: credential
    });
  } catch (error) {
    console.error('Erro ao adicionar credenciais:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}