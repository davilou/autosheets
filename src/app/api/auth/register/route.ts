import { NextRequest, NextResponse } from 'next/server';
import AuthService from '@/lib/auth/service';

const authService = new AuthService();

// Serialização segura de BigInt
function jsonSafe<T>(data: T) {
  return JSON.parse(
    JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, username, password, telegramUserId } = body;

    if (!email || !username || !password) {
      return NextResponse.json(
        { success: false, message: 'Email, username e senha são obrigatórios' },
        { status: 400 }
      );
    }

    const result = await authService.register({
      email,
      username,
      password,
      telegramUserId,
    });

    if (result.success) {
      return NextResponse.json(jsonSafe(result), { status: 201 });
    } else {
      return NextResponse.json(jsonSafe(result), { status: 400 });
    }
  } catch (error) {
    console.error('Erro na API de registro:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}