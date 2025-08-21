import { NextRequest, NextResponse } from 'next/server';
import AuthService from '@/lib/auth/service';

const authService = new AuthService();

// Serialização segura de BigInt
function jsonSafe<T>(data: T) {
  return JSON.parse(
    JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
  );
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, message: 'Token não fornecido' },
        { status: 401 }
      );
    }
    
    const token = authHeader.substring(7);
    const result = await authService.verifyToken(token);
    
    if (result.success) {
      return NextResponse.json(jsonSafe({
        success: true,
        user: result.user
      }));
    } else {
      return NextResponse.json(
        { success: false, message: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Erro na verificação do token:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}