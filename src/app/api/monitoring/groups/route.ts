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

// GET - Listar grupos monitorados
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || user.id;
    const credentialId = searchParams.get('credentialId');

    // Verificar se o usuário tem acesso
    if (userId !== user.id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const whereClause: any = { userId };
    if (credentialId) {
      whereClause.credentialId = credentialId;
    }

    const groups = await prisma.monitoredGroup.findMany({
      where: whereClause,
      include: {
        credential: {
          select: {
            sessionName: true,
            status: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Processar dados JSON
    const processedGroups = groups.map(group => ({
      ...group,
      keywords: group.keywords ? JSON.parse(group.keywords) : [],
      excludeKeywords: group.excludeKeywords ? JSON.parse(group.excludeKeywords) : [],
      allowedUsers: group.allowedUsers ? JSON.parse(group.allowedUsers) : [],
      blockedUsers: group.blockedUsers ? JSON.parse(group.blockedUsers) : [],
      timeFilters: group.timeFilters ? JSON.parse(group.timeFilters) : null,
    }));

    return NextResponse.json(processedGroups);
  } catch (error) {
    console.error('Erro ao buscar grupos monitorados:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Adicionar grupo ao monitoramento
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const {
      userId,
      credentialId,
      chatId,
      chatTitle,
      chatType,
      keywords = [],
      excludeKeywords = [],
      allowedUsers = [],
      blockedUsers = [],
      minOdds,
      maxOdds,
      timeFilters
    } = body;

    // Verificar se o usuário tem acesso
    if (userId !== user.id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Verificar se a credencial pertence ao usuário
    const credential = await prisma.telegramCredential.findFirst({
      where: {
        id: credentialId,
        userId: user.id
      }
    });

    if (!credential) {
      return NextResponse.json(
        { error: 'Credencial não encontrada' },
        { status: 404 }
      );
    }

    // Normalizar chatId conforme o tipo, alinhado com o monitor (-100 para canais/supergrupos, - para grupos)
    const normalizedChatId = (() => {
      const raw = String(chatId);
      if (chatType === 'channel' || chatType === 'supergroup') {
        if (raw.startsWith('-100')) return raw;
        return `-100${raw.replace(/^-100/, '').replace(/^-/, '')}`;
      }
      // group
      if (raw.startsWith('-') && !raw.startsWith('-100')) return raw;
      return `-${raw.replace(/^-100/, '').replace(/^-/, '')}`;
    })();

    // Verificar se o grupo já está sendo monitorado
    const existingGroup = await prisma.monitoredGroup.findFirst({
      where: {
        userId,
        credentialId,
        chatId: normalizedChatId
      }
    });

    if (existingGroup) {
      return NextResponse.json(
        { error: 'Grupo já está sendo monitorado' },
        { status: 409 }
      );
    }

    // Criar novo grupo monitorado
    const newGroup = await prisma.monitoredGroup.create({
      data: {
        userId,
        credentialId,
        chatId: normalizedChatId,
        chatTitle,
        chatType,
        keywords: keywords.length > 0 ? JSON.stringify(keywords) : null,
        excludeKeywords: excludeKeywords.length > 0 ? JSON.stringify(excludeKeywords) : null,
        allowedUsers: allowedUsers.length > 0 ? JSON.stringify(allowedUsers) : null,
        blockedUsers: blockedUsers.length > 0 ? JSON.stringify(blockedUsers) : null,
        minOdds,
        maxOdds,
        timeFilters: timeFilters ? JSON.stringify(timeFilters) : null,
      }
    });

    // Se existir uma sessão ativa para este usuário/credencial, solicitar reinício automático
    try {
      await prisma.userMonitorSession.updateMany({
        where: {
          userId,
          credentialId,
          isActive: true
        },
        data: {
          restartRequested: true
        }
      });
    } catch (e) {
      console.error('Erro ao sinalizar reinício automático após adicionar grupo:', e);
      // Não falhar a criação do grupo por causa disso
    }

    return NextResponse.json(newGroup, { status: 201 });
  } catch (error) {
    console.error('Erro ao adicionar grupo:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}