import { NextRequest, NextResponse } from 'next/server';
import AuthService from '@/lib/auth/service';
import { z } from 'zod';

const authService = new AuthService();

// Schema de validação
const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validar dados de entrada
    const validationResult = verifyEmailSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Dados inválidos',
          errors: validationResult.error.issues 
        },
        { status: 400 }
      );
    }

    const { token } = validationResult.data;

    // Verificar email
    const result = await authService.verifyEmail(token);

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message
    });

  } catch (error) {
    console.error('Erro na verificação de email:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Método GET para verificação via URL (query params)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Token é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar email
    const result = await authService.verifyEmail(token);

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message
    });

  } catch (error) {
    console.error('Erro na verificação de email:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}