/**
 * Serviço de validação das credenciais do Telegram
 */

export interface TelegramCredentials {
  apiId: string;
  apiHash: string;
  phoneNumber: string;
}

/**
 * Valida o formato das credenciais do Telegram
 */
export function validateCredentialsFormat(credentials: TelegramCredentials): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Valida API ID
  if (!credentials.apiId || credentials.apiId.trim() === '') {
    errors.push('API ID é obrigatório');
  } else if (!/^\d+$/.test(credentials.apiId)) {
    errors.push('API ID deve conter apenas números');
  } else if (credentials.apiId.length < 6 || credentials.apiId.length > 10) {
    errors.push('API ID deve ter entre 6 e 10 dígitos');
  }

  // Valida API Hash
  if (!credentials.apiHash || credentials.apiHash.trim() === '') {
    errors.push('API Hash é obrigatório');
  } else if (!/^[a-f0-9]{32}$/i.test(credentials.apiHash)) {
    errors.push('API Hash deve ser um hash MD5 válido (32 caracteres hexadecimais)');
  }

  // Valida número de telefone
  if (!credentials.phoneNumber || credentials.phoneNumber.trim() === '') {
    errors.push('Número de telefone é obrigatório');
  } else {
    const cleanPhone = credentials.phoneNumber.replace(/[^\d+]/g, '');
    if (!/^\+?[1-9]\d{1,14}$/.test(cleanPhone)) {
      errors.push('Número de telefone deve estar no formato internacional (ex: +5511999999999)');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Valida as credenciais do Telegram fazendo uma verificação básica
 * Em um ambiente real, isso poderia fazer uma chamada para a API do Telegram
 */
export async function validateTelegramCredentials(
  credentials: TelegramCredentials
): Promise<boolean> {
  try {
    // Primeiro valida o formato
    const formatValidation = validateCredentialsFormat(credentials);
    if (!formatValidation.isValid) {
      return false;
    }

    // TODO: Implementar validação real com a API do Telegram
    // Por enquanto, apenas valida o formato
    // Em produção, você poderia:
    // 1. Tentar criar uma sessão temporária
    // 2. Verificar se as credenciais são aceitas pelo Telegram
    // 3. Validar o número de telefone
    
    return true;
  } catch (error) {
    console.error('Erro ao validar credenciais do Telegram:', error);
    return false;
  }
}

/**
 * Normaliza o número de telefone para o formato internacional
 */
export function normalizePhoneNumber(phoneNumber: string): string {
  // Remove todos os caracteres não numéricos exceto o +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // Se não começar com +, adiciona
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  
  return cleaned;
}

/**
 * Valida se um nome de sessão é válido
 */
export function validateSessionName(sessionName: string): {
  isValid: boolean;
  error?: string;
} {
  if (!sessionName || sessionName.trim() === '') {
    return {
      isValid: false,
      error: 'Nome da sessão é obrigatório'
    };
  }

  if (sessionName.length < 3) {
    return {
      isValid: false,
      error: 'Nome da sessão deve ter pelo menos 3 caracteres'
    };
  }

  if (sessionName.length > 50) {
    return {
      isValid: false,
      error: 'Nome da sessão deve ter no máximo 50 caracteres'
    };
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(sessionName)) {
    return {
      isValid: false,
      error: 'Nome da sessão deve conter apenas letras, números, _ e -'
    };
  }

  return { isValid: true };
}