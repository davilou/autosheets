import { SpreadsheetTemplate } from '../drive/service';

/**
 * Templates padrão para diferentes tipos de planilhas de apostas
 */
export const BETTING_TEMPLATES = {
  /**
   * Template básico para apostas esportivas
   */
  BASIC_BETTING: {
    title: 'Planilha de Apostas - Básica',
    headers: [
      'BetId',
      'Data',
      'Hora',
      'Jogo',
      'Placar',
      'Mercado',
      'Linha da Aposta',
      'Odd Tipster',
      'Pegou',
      'Odd Real',
      'Stake',
      'Grupo',
      'Resultado'
    ],
    defaultData: [
      [
        '000001',
        '=TODAY()',
        '=TEXT(NOW();"HH:MM")',
        'Exemplo: Time A vs Time B',
        '0-0',
        'Gols',
        'Over 2.5',
        1.85,
        'Sim',
        1.80,
        1,
        '',
        'Pendente'
      ]
    ]
  } as SpreadsheetTemplate
};

/**
 * Configurações personalizáveis para colunas
 */
export interface ColumnConfig {
  name: string;
  type: 'text' | 'number' | 'date' | 'formula' | 'dropdown';
  required: boolean;
  defaultValue?: string;
  options?: string[]; // Para dropdown
  formula?: string; // Para colunas calculadas
  format?: string; // Formato de exibição
}

/**
 * Configurações padrão de colunas
 */
export const DEFAULT_COLUMNS: ColumnConfig[] = [
  {
    name: 'BetId',
    type: 'text',
    required: true,
    format: 'text'
  },
  {
    name: 'Data',
    type: 'date',
    required: true,
    defaultValue: '=TODAY()',
    format: 'dd/mm/yyyy'
  },
  {
    name: 'Hora',
    type: 'text',
    required: false,
    defaultValue: '=TEXT(NOW(),"HH:MM")',
    format: 'hh:mm'
  },
  {
    name: 'Jogo',
    type: 'text',
    required: true
  },
  {
    name: 'Placar',
    type: 'text',
    required: false,
    defaultValue: '0-0'
  },
  {
    name: 'Mercado',
    type: 'dropdown',
    required: true,
    options: ['Gols', 'Resultado', 'Handicap', 'Escanteios', 'Cartões', 'Ambas Marcam']
  },
  {
    name: 'Linha da Aposta',
    type: 'text',
    required: true
  },
  {
    name: 'Odd Tipster',
    type: 'number',
    required: true,
    format: '0.00'
  },
  {
    name: 'Pegou',
    type: 'dropdown',
    required: false,
    options: ['Sim', 'Não'],
    defaultValue: 'Não'
  },
  {
    name: 'Odd Real',
    type: 'number',
    required: false,
    format: '0.00'
  },
  {
    name: 'Stake',
    type: 'number',
    required: false,
    format: 'R$ #,##0.00'
  },
  {
    name: 'Resultado',
    type: 'dropdown',
    required: false,
    options: ['Pendente', 'Green', 'Red'],
    defaultValue: 'Pendente'
  }
];

/**
 * Classe para gerenciar templates personalizados
 */
export class TemplateManager {
  /**
   * Cria um template personalizado baseado nas configurações de colunas
   */
  static createCustomTemplate(
    title: string,
    columns: ColumnConfig[],
    includeExampleData: boolean = true
  ): SpreadsheetTemplate {
    const headers = columns.map(col => col.name);
    
    let defaultData: string[][] = [];
    
    if (includeExampleData) {
      const exampleRow = columns.map(col => {
        if (col.defaultValue) {
          return col.defaultValue;
        }
        
        switch (col.type) {
          case 'date':
            return '=TODAY()';
          case 'number':
            return '0';
          case 'dropdown':
            return col.options?.[0] || '';
          case 'formula':
            return col.formula?.replace('{row}', '2') || '';
          default:
            return `Exemplo ${col.name}`;
        }
      });
      
      defaultData = [exampleRow];
    }
    
    return {
      title,
      headers,
      defaultData
    };
  }
  
  /**
   * Valida se um template está correto
   */
  static validateTemplate(template: SpreadsheetTemplate): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!template.title || template.title.trim().length === 0) {
      errors.push('Título do template é obrigatório');
    }
    
    if (!template.headers || template.headers.length === 0) {
      errors.push('Template deve ter pelo menos um cabeçalho');
    }
    
    if (template.headers && template.headers.some(header => !header || header.trim().length === 0)) {
      errors.push('Todos os cabeçalhos devem ter nomes válidos');
    }
    
    if (template.defaultData) {
      template.defaultData.forEach((row, index) => {
        if (row.length !== template.headers.length) {
          errors.push(`Linha ${index + 1} dos dados padrão tem número incorreto de colunas`);
        }
      });
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Obtém template por nome
   */
  static getTemplate(templateName: keyof typeof BETTING_TEMPLATES): SpreadsheetTemplate {
    return BETTING_TEMPLATES[templateName];
  }
  
  /**
   * Lista todos os templates disponíveis com descrições detalhadas
   */
  static listTemplates(): Array<{ 
    key: string; 
    name: string; 
    description: string;
    detailedDescription: string;
    columns: Array<{ name: string; description: string; type: string }>;
    useCase: string;
  }> {
    return [
      {
        key: 'BASIC_BETTING',
        name: 'Apostas Básica',
        description: 'Template simples para controle de apostas esportivas',
        detailedDescription: 'Planilha ideal para iniciantes que querem começar a controlar suas apostas de forma organizada. Inclui as informações essenciais para acompanhar resultados e calcular lucros/prejuízos automaticamente.',
        useCase: 'Perfeita para apostadores iniciantes ou que preferem simplicidade no controle de apostas.',
        columns: [
          { name: 'Data', description: 'Data da aposta (preenchimento automático)', type: 'Data' },
          { name: 'Hora', description: 'Horário da aposta (preenchimento automático)', type: 'Hora' },
          { name: 'Jogo', description: 'Times ou evento da aposta', type: 'Texto' },
          { name: 'Placar', description: 'Resultado final do jogo', type: 'Texto' },
          { name: 'Mercado', description: 'Tipo de mercado apostado (Gols, Resultado, etc.)', type: 'Texto' },
          { name: 'Linha da Aposta', description: 'Especificação da aposta (Over 2.5, Vitória do Time A, etc.)', type: 'Texto' },
          { name: 'Odd Tipster', description: 'Odd informada pelo tipster', type: 'Número' },
          { name: 'Pegou', description: 'Se conseguiu apostar (Sim/Não)', type: 'Seleção' },
          { name: 'Odd Real', description: 'Odd real conseguida na casa de apostas', type: 'Número' },
          { name: 'Stake', description: 'Valor em reais apostado', type: 'Moeda' },
          { name: 'Resultado', description: 'Resultado da aposta (calculado automaticamente)', type: 'Fórmula' },
          { name: 'Lucro/Prejuízo', description: 'Valor ganho ou perdido (calculado automaticamente)', type: 'Fórmula' }
        ]
      },
      {
        key: 'ADVANCED_BETTING',
        name: 'Apostas Avançada',
        description: 'Template completo com análise estatística e ROI',
        detailedDescription: 'Planilha completa para apostadores experientes que desejam análise detalhada de performance. Inclui cálculos de ROI, controle por tipster, níveis de confiança e campos para observações estratégicas.',
        useCase: 'Ideal para apostadores profissionais ou semi-profissionais que precisam de análise detalhada de performance.',
        columns: [
          { name: 'Data', description: 'Data da aposta (preenchimento automático)', type: 'Data' },
          { name: 'Hora', description: 'Horário da aposta (preenchimento automático)', type: 'Hora' },
          { name: 'Jogo', description: 'Times ou evento da aposta', type: 'Texto' },
          { name: 'Liga/Campeonato', description: 'Competição onde ocorre o jogo', type: 'Texto' },
          { name: 'Placar', description: 'Resultado final do jogo', type: 'Texto' },
          { name: 'Mercado', description: 'Tipo de mercado apostado', type: 'Texto' },
          { name: 'Linha da Aposta', description: 'Especificação detalhada da aposta', type: 'Texto' },
          { name: 'Odd Tipster', description: 'Odd informada pelo tipster', type: 'Número' },
          { name: 'Pegou', description: 'Se conseguiu apostar na odd informada', type: 'Seleção' },
          { name: 'Odd Real', description: 'Odd real conseguida na casa de apostas', type: 'Número' },
          { name: 'Stake', description: 'Valor em reais apostado', type: 'Moeda' },
          { name: 'Resultado', description: 'Resultado da aposta (calculado automaticamente)', type: 'Fórmula' },
          { name: 'Lucro/Prejuízo', description: 'Valor ganho ou perdido (calculado automaticamente)', type: 'Fórmula' },
          { name: 'ROI (%)', description: 'Retorno sobre investimento da aposta (calculado automaticamente)', type: 'Fórmula' },
          { name: 'Tipster', description: 'Nome do tipster ou fonte da dica', type: 'Texto' },
          { name: 'Confiança', description: 'Nível de confiança na aposta (Alta/Média/Baixa)', type: 'Seleção' },
          { name: 'Observações', description: 'Notas e observações sobre a aposta', type: 'Texto' }
        ]
      },
      {
        key: 'BANKROLL_MANAGEMENT',
        name: 'Controle de Bankroll',
        description: 'Gerenciamento de banca e movimentações financeiras',
        detailedDescription: 'Planilha especializada no controle rigoroso da banca de apostas. Registra todas as movimentações financeiras (depósitos, saques, apostas) e calcula automaticamente saldos e percentuais do bankroll.',
        useCase: 'Essencial para apostadores que querem manter controle financeiro rigoroso e gestão de risco adequada.',
        columns: [
          { name: 'Data', description: 'Data da movimentação financeira', type: 'Data' },
          { name: 'Tipo Operação', description: 'Tipo de movimentação (Depósito, Saque, Aposta, etc.)', type: 'Seleção' },
          { name: 'Valor', description: 'Valor da operação em reais', type: 'Moeda' },
          { name: 'Saldo Anterior', description: 'Saldo antes da operação', type: 'Moeda' },
          { name: 'Saldo Atual', description: 'Saldo após a operação (calculado automaticamente)', type: 'Fórmula' },
          { name: 'Percentual do Bankroll', description: 'Percentual que o valor representa do bankroll total', type: 'Fórmula' },
          { name: 'Descrição', description: 'Descrição detalhada da operação', type: 'Texto' },
          { name: 'Categoria', description: 'Categoria da operação para análise', type: 'Seleção' }
        ]
      },
      {
        key: 'TIPSTER_ANALYSIS',
        name: 'Análise de Tipsters',
        description: 'Acompanhamento de performance de tipsters',
        detailedDescription: 'Planilha analítica para avaliar a performance de diferentes tipsters. Calcula automaticamente estatísticas como taxa de acerto, ROI, sequências de vitórias/derrotas e classifica a qualidade de cada tipster.',
        useCase: 'Fundamental para quem segue múltiplos tipsters e quer identificar os mais lucrativos e confiáveis.',
        columns: [
          { name: 'Tipster', description: 'Nome ou identificação do tipster', type: 'Texto' },
          { name: 'Total de Tips', description: 'Número total de dicas do tipster (calculado automaticamente)', type: 'Fórmula' },
          { name: 'Tips Certas', description: 'Número de dicas certas (calculado automaticamente)', type: 'Fórmula' },
          { name: 'Tips Erradas', description: 'Número de dicas erradas (calculado automaticamente)', type: 'Fórmula' },
          { name: 'Taxa de Acerto (%)', description: 'Percentual de acerto do tipster (calculado automaticamente)', type: 'Fórmula' },
          { name: 'Odd Média', description: 'Odd média das dicas do tipster (calculado automaticamente)', type: 'Fórmula' },
          { name: 'Lucro Total', description: 'Lucro total gerado pelo tipster (calculado automaticamente)', type: 'Fórmula' },
          { name: 'ROI (%)', description: 'Retorno sobre investimento do tipster (calculado automaticamente)', type: 'Fórmula' },
          { name: 'Melhor Sequência', description: 'Maior sequência de acertos consecutivos', type: 'Número' },
          { name: 'Pior Sequência', description: 'Maior sequência de erros consecutivos', type: 'Número' },
          { name: 'Status', description: 'Classificação do tipster baseada na performance (calculado automaticamente)', type: 'Fórmula' },
          { name: 'Última Atualização', description: 'Data da última atualização dos dados', type: 'Data' }
        ]
      }
    ];
  }
}

export default TemplateManager;