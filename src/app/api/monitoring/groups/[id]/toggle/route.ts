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

// PATCH - Toggle status do grupo (ativo/inativo)
export async function PATCH(
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
    const { isActive } = body;

    if (typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'Status inválido' },
        { status: 400 }
      );
    }

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

    // Atualizar status
    const updatedGroup = await prisma.monitoredGroup.update({
      where: { id: groupId },
      data: {
        isActive,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({
      message: `Grupo ${isActive ? 'ativado' : 'desativado'} com sucesso`,
      group: updatedGroup
    });
  } catch (error) {
    console.error('Erro ao alterar status do grupo:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}