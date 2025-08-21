import { NextRequest, NextResponse } from 'next/server';
import AuthService from '@/lib/auth/service';

const authService = new AuthService();

// Evitar erro de serialização de BigInt em respostas JSON
function jsonSafe<T>(data: T) {
  return JSON.parse(
    JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
  );
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔐 Tentativa de login iniciada');
    const body = await request.json();
    const { email, password } = body;
    
    console.log('📧 Email recebido:', email);
    console.log('🔑 Senha recebida (length):', password?.length);

    if (!email || !password) {
      console.log('❌ Email ou senha não fornecidos');
      return NextResponse.json(
        { success: false, message: 'Email e senha são obrigatórios' },
        { status: 400 }
      );
    }

    console.log('🔍 Chamando authService.login...');
    const result = await authService.login({ email, password });
    console.log('📊 Resultado do login:', { success: result.success, message: result.message });

    if (result.success) {
      console.log('✅ Login bem-sucedido');
      return NextResponse.json(jsonSafe(result), { status: 200 });
    } else {
      console.log('❌ Login falhou:', result.message);
      return NextResponse.json(jsonSafe(result), { status: 401 });
    }
  } catch (error) {
    console.error('💥 Erro na API de login:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}