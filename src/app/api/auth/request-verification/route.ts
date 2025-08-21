import { NextRequest, NextResponse } from 'next/server';
import AuthService from '@/lib/auth/service';
import { z } from 'zod';

const authService = new AuthService();

// Schema de validação
const requestVerificationSchema = z.object({
  userId: z.string().min(1, 'ID do usuário é obrigatório'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validar dados de entrada
    const validationResult = requestVerificationSchema.safeParse(body);
    
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

    const { userId } = validationResult.data;

    // Solicitar verificação de email
    const result = await authService.requestEmailVerification(userId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      token: result.token // Para desenvolvimento/teste
    });

  } catch (error) {
    console.error('Erro ao solicitar verificação de email:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}