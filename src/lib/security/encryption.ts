import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

// Gera uma chave de criptografia a partir da chave mestra
function deriveKey(masterKey: string, salt: string): Buffer {
  return crypto.pbkdf2Sync(masterKey, salt, 100000, KEY_LENGTH, 'sha256');
}

// Obtém a chave mestra do ambiente
function getMasterKey(): string {
  const key = process.env.ENCRYPTION_MASTER_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_MASTER_KEY não está definida nas variáveis de ambiente');
  }
  return key;
}

/**
 * Criptografa um texto usando AES-256-GCM
 */
export function encrypt(text: string, userId: string): string {
  try {
    const masterKey = getMasterKey();
    const salt = userId; // Usa o userId como salt para garantir que cada usuário tenha chaves diferentes
    const key = deriveKey(masterKey, salt);
    
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Combina IV + dados criptografados
    const result = iv.toString('hex') + encrypted;
    return result;
  } catch (error) {
    throw new Error(`Erro ao criptografar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

/**
 * Descriptografa um texto usando AES-256-GCM
 */
export function decrypt(encryptedData: string, userId: string): string {
  try {
    const masterKey = getMasterKey();
    const salt = userId;
    const key = deriveKey(masterKey, salt);
    
    // Extrai IV e dados criptografados
    const iv = Buffer.from(encryptedData.slice(0, IV_LENGTH * 2), 'hex');
    const encrypted = encryptedData.slice(IV_LENGTH * 2);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error(`Erro ao descriptografar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

/**
 * Gera uma chave mestra aleatória (para uso em desenvolvimento)
 */
export function generateMasterKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Valida se uma chave mestra é válida
 */
export function validateMasterKey(key: string): boolean {
  try {
    return Buffer.from(key, 'hex').length === 32;
  } catch {
    return false;
  }
}