import { NextRequest, NextResponse } from 'next/server';
import TemplateManager from '@/lib/spreadsheets/templates';
import AuthService from '@/lib/auth/service';

const authService = new AuthService();

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

/**
 * GET /api/spreadsheets/templates
 * Lista todos os templates disponíveis
 */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    const templates = TemplateManager.listTemplates();
    
    return NextResponse.json({
      success: true,
      data: {
        templates,
        total: templates.length
      }
    });
  } catch (error) {
    console.error('Erro ao listar templates:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/spreadsheets/templates/validate
 * Valida um template personalizado
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { template } = body;

    if (!template) {
      return NextResponse.json(
        { success: false, message: 'Template é obrigatório' },
        { status: 400 }
      );
    }

    const validation = TemplateManager.validateTemplate(template);
    
    return NextResponse.json({
      success: true,
      data: {
        valid: validation.valid,
        errors: validation.errors
      }
    });
  } catch (error) {
    console.error('Erro ao validar template:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}