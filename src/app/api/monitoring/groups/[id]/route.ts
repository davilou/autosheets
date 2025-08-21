import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import AuthService from '@/lib/auth/service';

const prisma = new PrismaClient();
const authService = new AuthService();

// Middleware de autenticação
async function authenticate(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const result = await authService.verifyToken(token);
    return result.success ? result.user : null;
  } catch (error) {
    console.error('Erro na autenticação:', error);
    return null;
  }
}

// PUT - Atualizar configurações do grupo
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const groupId = id;
    const body = await request.json();
    const {
      keywords = [],
      excludeKeywords = [],
      allowedUsers = [],
      blockedUsers = [],
      minOdds,
      maxOdds,
      timeFilters
    } = body;

    // Verificar se o grupo pertence ao usuário
    const existingGroup = await prisma.monitoredGroup.findFirst({
      where: {
        id: groupId,
        userId: user.id
      }
    });

    if (!existingGroup) {
      return NextResponse.json(
        { error: 'Grupo não encontrado' },
        { status: 404 }
      );
    }

    // Atualizar grupo
    const updatedGroup = await prisma.monitoredGroup.update({
      where: { id: groupId },
      data: {
        keywords: keywords.length > 0 ? JSON.stringify(keywords) : null,
        excludeKeywords: excludeKeywords.length > 0 ? JSON.stringify(excludeKeywords) : null,
        allowedUsers: allowedUsers.length > 0 ? JSON.stringify(allowedUsers) : null,
        blockedUsers: blockedUsers.length > 0 ? JSON.stringify(blockedUsers) : null,
        minOdds,
        maxOdds,
        timeFilters: timeFilters ? JSON.stringify(timeFilters) : null,
        updatedAt: new Date()
      }
    });

    return NextResponse.json(updatedGroup);
  } catch (error) {
    console.error('Erro ao atualizar grupo:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Remover grupo do monitoramento
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const groupId = id;

    // Verificar se o grupo pertence ao usuário
    const existingGroup = await prisma.monitoredGroup.findFirst({
      where: {
        id: groupId,
        userId: user.id
      }
    });

    if (!existingGroup) {
      return NextResponse.json(
        { error: 'Grupo não encontrado' },
        { status: 404 }
      );
    }

    // Remover grupo
    await prisma.monitoredGroup.delete({
      where: { id: groupId }
    });

    return NextResponse.json({ message: 'Grupo removido com sucesso' });
  } catch (error) {
    console.error('Erro ao remover grupo:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}