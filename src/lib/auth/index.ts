import DatabaseAuthService from './database-service';
import { getUserFromToken, getTokenFromRequest, verifyJWTToken } from './utils';
import { NextRequest } from 'next/server';

// Instância do serviço de autenticação
const authService = new DatabaseAuthService();

// Função wrapper para verifyToken que aceita NextRequest
export async function verifyToken(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return null;
  }
  
  const result = await authService.verifyToken(token);
  return result.success ? result.user : null;
}

// Re-exportar todas as funções e tipos necessários
export { default as AuthService } from './service';
export { default as DatabaseAuthService } from './database-service';
export { getUserFromToken, getTokenFromRequest, verifyJWTToken } from './utils';
export type { User, LoginCredentials, RegisterData, UserWithoutPassword } from './database-service';

// Exportar instância padrão do serviço
export default authService;