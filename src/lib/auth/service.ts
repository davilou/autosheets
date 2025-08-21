import DatabaseAuthService from './database-service';

// Re-exportar o DatabaseAuthService como AuthService para manter compatibilidade
class AuthService extends DatabaseAuthService {}

export default AuthService;
export type { User, LoginCredentials, RegisterData } from './database-service';