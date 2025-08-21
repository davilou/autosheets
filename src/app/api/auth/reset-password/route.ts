import { NextRequest, NextResponse } from 'next/server';
import AuthService from '@/lib/auth/service';

const authService = new AuthService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { success: false, message: 'Token e nova senha são obrigatórios' },
        { status: 400 }
      );
    }

    const result = await authService.resetPassword(token, password);

    if (result.success) {
      return NextResponse.json(result, { status: 200 });
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error) {
    console.error('Erro na API de redefinição de senha:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}