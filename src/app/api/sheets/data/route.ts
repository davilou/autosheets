import { NextRequest, NextResponse } from 'next/server';
import GoogleSheetsService from '@/lib/sheets/service';
import AuthService from '@/lib/auth/service';

const authService = new AuthService();

const sheetsConfig = {
  spreadsheetId: process.env.GOOGLE_SHEETS_ID!,
  range: 'Apostas!A:L',
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL!,
    private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  },
};

const sheetsService = new GoogleSheetsService(sheetsConfig);

// Middleware de autenticação
async function authenticate(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  const result = await authService.verifyToken(token);
  
  return result.valid ? result.user : null;
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
    const { betData } = body;
    
    if (!betData) {
      return NextResponse.json(
        { success: false, message: 'Dados da aposta são obrigatórios' },
        { status: 400 }
      );
    }
    
    const success = await sheetsService.addBetData(betData);
    
    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Dados adicionados com sucesso',
      });
    } else {
      return NextResponse.json(
        { success: false, message: 'Erro ao adicionar dados' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Erro ao adicionar dados:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}