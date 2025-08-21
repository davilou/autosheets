import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import GoogleDriveService from '@/lib/drive/service';
import { BETTING_TEMPLATES } from '@/lib/spreadsheets/templates';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
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
    const { template, name } = await request.json();

    // Buscar dados do usuário
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se o usuário já tem uma planilha ativa
    const existingSpreadsheet = await prisma.userSpreadsheet.findFirst({
      where: {
        userId: userId,
        isActive: true
      }
    });

    if (existingSpreadsheet) {
      return NextResponse.json(
        { error: 'Você já possui uma planilha ativa. Exclua a planilha atual antes de criar uma nova.' },
        { status: 400 }
      );
    }

    // Buscar credenciais OAuth2 do usuário
    const googleCredential = await prisma.googleDriveCredential.findFirst({
      where: { 
        userId,
        status: 'CONNECTED'
      }
    });

    if (!googleCredential || googleCredential.status !== 'CONNECTED') {
      return NextResponse.json(
        { error: 'Credenciais do Google Drive não encontradas ou não conectadas' },
        { status: 401 }
      );
    }

    if (!googleCredential.accessToken || !googleCredential.refreshToken) {
      return NextResponse.json(
        { error: 'Tokens de acesso não encontrados' },
        { status: 401 }
      );
    }

    // Usar credenciais OAuth2 do usuário
    const driveService = new GoogleDriveService({
      oauth: {
        access_token: googleCredential.accessToken,
        refresh_token: googleCredential.refreshToken
      }
    });
    
    await driveService.initialize();

    // Obter template
    const templateData = BETTING_TEMPLATES[template as keyof typeof BETTING_TEMPLATES];
    if (!templateData) {
      return NextResponse.json(
        { error: 'Template não encontrado' },
        { status: 400 }
      );
    }

    // Criar planilha no Google Sheets
    const spreadsheet = await driveService.createSpreadsheet({
      title: name || templateData.title,
      headers: templateData.headers,
      defaultData: templateData.defaultData
    }, user.email);

    // Salvar planilha no banco de dados
    const userSpreadsheet = await prisma.userSpreadsheet.create({
      data: {
        userId: userId,
        name: spreadsheet.name,
        spreadsheetId: spreadsheet.id,
        url: spreadsheet.url,
        templateType: template,
        isActive: true
      }
    });

    return NextResponse.json({
      success: true,
      spreadsheet: {
        id: userSpreadsheet.id,
        name: userSpreadsheet.name,
        url: userSpreadsheet.url,
        lastModified: userSpreadsheet.updatedAt,
        isActive: userSpreadsheet.isActive
      }
    });

  } catch (error) {
    console.error('Erro ao criar planilha:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}