import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';

const addCredentialSchema = z.object({
  email: z.string().email('Email inválido'),
});

// GET - Listar credenciais do usuário
export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const credentials = await prisma.googleDriveCredential.findMany({
      where: {
        userId: user.id,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        status: true,
        lastConnected: true,
        lastError: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ credentials });
  } catch (error) {
    console.error('Erro ao buscar credenciais:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Adicionar nova credencial
export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { email } = addCredentialSchema.parse(body);

    // Verificar se já existe uma credencial com este email para este usuário
    const existingCredential = await prisma.googleDriveCredential.findUnique({
      where: {
        userId_email: {
          userId: user.id,
          email: email,
        },
      },
    });

    if (existingCredential) {
      return NextResponse.json(
        { error: 'Já existe uma credencial com este email' },
        { status: 400 }
      );
    }

    // Criar nova credencial
    const credential = await prisma.googleDriveCredential.create({
      data: {
        userId: user.id,
        email: email,
        status: 'DISCONNECTED',
      },
      select: {
        id: true,
        email: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ credential }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Erro ao criar credencial:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}