import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Token de autorização não fornecido' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    let decoded: any;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!);
    } catch (error) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      );
    }

    const userId = decoded.userId;

    // Buscar planilha do usuário
    const userSpreadsheet = await prisma.userSpreadsheet.findFirst({
      where: {
        userId: userId,
        isActive: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!userSpreadsheet) {
      return NextResponse.json(
        { spreadsheet: null },
        { status: 200 }
      );
    }

    // Retornar dados da planilha
    return NextResponse.json({
      spreadsheet: {
        id: userSpreadsheet.id,
        name: userSpreadsheet.name,
        url: userSpreadsheet.url,
        lastModified: userSpreadsheet.updatedAt,
        isActive: userSpreadsheet.isActive
      }
    });

  } catch (error) {
    console.error('Erro ao buscar planilha do usuário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}