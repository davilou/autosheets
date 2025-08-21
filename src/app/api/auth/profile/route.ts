import { NextRequest, NextResponse } from 'next/server';
import AuthService from '@/lib/auth/service';
import { z } from 'zod';
import jwt from 'jsonwebtoken';

const authService = new AuthService();

// Serialização segura de BigInt
function jsonSafe<T>(data: T) {
  return JSON.parse(
    JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
  );
}

// Schema de validação
const updateProfileSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  telegramId: z.string().optional(),
});

export async function PUT(request: NextRequest) {
  try {
    // Verificar token de autorização
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, message: 'Token de autorização necessário' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    let decoded: any;
    
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    } catch (error) {
      return NextResponse.json(
        { success: false, message: 'Token inválido' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Validar dados de entrada
    const validationResult = updateProfileSchema.safeParse(body);
    
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

    const { name, email, telegramId } = validationResult.data;

    // Atualizar perfil
    const result = await authService.updateProfile(decoded.userId, {
      name,
      email,
      telegramId
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json(jsonSafe({
      success: true,
      message: 'Perfil atualizado com sucesso',
      user: result.user
    }));

  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// GET para obter dados do perfil
export async function GET(request: NextRequest) {
  try {
    // Verificar token de autorização
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, message: 'Token de autorização necessário' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    let decoded: any;
    
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    } catch (error) {
      return NextResponse.json(
        { success: false, message: 'Token inválido' },
        { status: 401 }
      );
    }

    // Obter dados do usuário
    const user = await authService.getUserById(decoded.userId);

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(jsonSafe({
      success: true,
      user: user
    }));

  } catch (error) {
    console.error('Erro ao obter perfil:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}