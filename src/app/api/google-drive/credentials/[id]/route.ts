import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// DELETE - Remover credencial
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const resolvedParams = await params;
    const credentialId = resolvedParams.id;

    // Verificar se a credencial existe e pertence ao usuário
    const credential = await prisma.googleDriveCredential.findFirst({
      where: {
        id: credentialId,
        userId: user.id,
      },
    });

    if (!credential) {
      return NextResponse.json(
        { error: 'Credencial não encontrada' },
        { status: 404 }
      );
    }

    // Remover a credencial (soft delete)
    await prisma.googleDriveCredential.update({
      where: {
        id: credentialId,
      },
      data: {
        isActive: false,
      },
    });

    return NextResponse.json({ message: 'Credencial removida com sucesso' });
  } catch (error) {
    console.error('Erro ao remover credencial:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}