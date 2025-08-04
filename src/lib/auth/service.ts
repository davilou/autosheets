import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { SECURITY_CONFIG } from '../security/config';

interface User {
  id: string;
  email: string;
  username: string;
  password: string;
  role: 'admin' | 'user';
  telegramUserId?: number;
  createdAt: Date;
  lastLogin?: Date;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterData {
  email: string;
  username: string;
  password: string;
  telegramUserId?: number;
}

class AuthService {
  private users: User[] = []; // Em produção, usar banco de dados
  private jwtSecret: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-super-secret-key';
    this.initializeMockUsers();
  }

  private initializeMockUsers() {
    // Usuário admin padrão para desenvolvimento
    const adminUser: User = {
      id: '1',
      email: 'admin@autosheets.com',
      username: 'admin',
      password: bcrypt.hashSync('Admin123!', 10),
      role: 'admin',
      createdAt: new Date(),
    };
    
    this.users.push(adminUser);
  }

  async register(data: RegisterData): Promise<{ success: boolean; message: string; user?: Partial<User> }> {
    try {
      // Validar se email já existe
      if (this.users.find(u => u.email === data.email)) {
        return { success: false, message: 'Email já cadastrado' };
      }

      // Validar se username já existe
      if (this.users.find(u => u.username === data.username)) {
        return { success: false, message: 'Username já cadastrado' };
      }

      // Validar força da senha
      if (!this.isPasswordStrong(data.password)) {
        return { 
          success: false, 
          message: 'Senha deve ter pelo menos 8 caracteres, incluindo maiúscula, minúscula, número e caractere especial' 
        };
      }

      // Criar novo usuário
      const hashedPassword = await bcrypt.hash(data.password, 10);
      const newUser: User = {
        id: (this.users.length + 1).toString(),
        email: data.email,
        username: data.username,
        password: hashedPassword,
        role: 'user',
        telegramUserId: data.telegramUserId,
        createdAt: new Date(),
      };

      this.users.push(newUser);

      const { password, ...userWithoutPassword } = newUser;
      return { 
        success: true, 
        message: 'Usuário criado com sucesso', 
        user: userWithoutPassword 
      };
    } catch (error) {
      console.error('Erro no registro:', error);
      return { success: false, message: 'Erro interno do servidor' };
    }
  }

  async login(credentials: LoginCredentials): Promise<{ success: boolean; message: string; token?: string; user?: Partial<User> }> {
    try {
      const user = this.users.find(u => u.email === credentials.email);
      
      if (!user) {
        return { success: false, message: 'Credenciais inválidas' };
      }

      const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
      
      if (!isPasswordValid) {
        return { success: false, message: 'Credenciais inválidas' };
      }

      // Atualizar último login
      user.lastLogin = new Date();

      // Gerar JWT token
      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email, 
          role: user.role 
        },
        this.jwtSecret,
        { expiresIn: '24h' }
      );

      const { password, ...userWithoutPassword } = user;
      return { 
        success: true, 
        message: 'Login realizado com sucesso', 
        token,
        user: userWithoutPassword 
      };
    } catch (error) {
      console.error('Erro no login:', error);
      return { success: false, message: 'Erro interno do servidor' };
    }
  }

  async verifyToken(token: string): Promise<{ valid: boolean; user?: Partial<User> }> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      const user = this.users.find(u => u.id === decoded.userId);
      
      if (!user) {
        return { valid: false };
      }

      const { password, ...userWithoutPassword } = user;
      return { valid: true, user: userWithoutPassword };
    } catch (error) {
      return { valid: false };
    }
  }

  private isPasswordStrong(password: string): boolean {
    const config = SECURITY_CONFIG.PASSWORD;
    
    if (password.length < config.minLength) return false;
    if (config.requireUppercase && !/[A-Z]/.test(password)) return false;
    if (config.requireLowercase && !/[a-z]/.test(password)) return false;
    if (config.requireNumbers && !/\d/.test(password)) return false;
    if (config.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) return false;
    
    return true;
  }

  getUserByTelegramId(telegramUserId: number): User | undefined {
    return this.users.find(u => u.telegramUserId === telegramUserId);
  }

  getAllUsers(): Partial<User>[] {
    return this.users.map(({ password, ...user }) => user);
  }
}

export default AuthService;
export type { User, LoginCredentials, RegisterData };