import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { User, Role } from '@prisma/client';
import { SECURITY_CONFIG } from '../security/config';
import crypto from 'crypto';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
  telegramUserId?: number;
}

export interface UserWithoutPassword extends Omit<User, 'passwordHash'> {
  name?: string;
}

// Re-exportar User do Prisma para compatibilidade
export type { User } from '@prisma/client';

class DatabaseAuthService {
  private jwtSecret: string;
  private resetTokens: Map<string, { userId: string; expires: Date }> = new Map();
  private verificationTokens: Map<string, { userId: string; expires: Date }> = new Map();

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-super-secret-key';
    this.cleanupExpiredTokens();
  }

  // Limpar tokens expirados a cada hora
  private cleanupExpiredTokens() {
    setInterval(() => {
      const now = new Date();
      
      // Limpar tokens de reset expirados
      for (const [token, data] of this.resetTokens.entries()) {
        if (data.expires < now) {
          this.resetTokens.delete(token);
        }
      }
      
      // Limpar tokens de verificação expirados
      for (const [token, data] of this.verificationTokens.entries()) {
        if (data.expires < now) {
          this.verificationTokens.delete(token);
        }
      }
    }, 60 * 60 * 1000); // 1 hora
  }

  // Gerar token aleatório
  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Validar força da senha
  private isPasswordStrong(password: string): boolean {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[@$!%*?&]/.test(password);
    
    return password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar;
  }

  async register(data: RegisterData): Promise<{ success: boolean; message: string; user?: UserWithoutPassword }> {
    try {
      // Validar se email já existe
      const existingUserByEmail = await prisma.user.findUnique({
        where: { email: data.email }
      });
      
      if (existingUserByEmail) {
        return { success: false, message: 'Email já cadastrado' };
      }

      // Validar se username já existe
      const existingUserByUsername = await prisma.user.findUnique({
        where: { username: data.username }
      });
      
      if (existingUserByUsername) {
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
      const newUser = await prisma.user.create({
        data: {
          email: data.email,
          username: data.username,
          passwordHash: hashedPassword,
          role: Role.USER,
          telegramUserId: data.telegramUserId || null,
        }
      });

      // Converter para formato sem senha
      const userWithoutPassword: UserWithoutPassword = {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        role: newUser.role,
        telegramUserId: newUser.telegramUserId,
        emailVerified: newUser.emailVerified,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        avatar: newUser.avatar,
        isActive: newUser.isActive,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt,
        lastLogin: newUser.lastLogin,
        name: newUser.username // Usar username como name por enquanto
      };

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

  async login(credentials: LoginCredentials): Promise<{ success: boolean; message: string; token?: string; user?: UserWithoutPassword }> {
    try {
      const user = await prisma.user.findUnique({
        where: { email: credentials.email }
      });
      
      if (!user) {
        return { success: false, message: 'Credenciais inválidas' };
      }

      const isPasswordValid = await bcrypt.compare(credentials.password, user.passwordHash);
      
      if (!isPasswordValid) {
        return { success: false, message: 'Credenciais inválidas' };
      }

      // Atualizar último login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
      });

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

      // Converter para formato sem senha
      const userWithoutPassword: UserWithoutPassword = {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        telegramUserId: user.telegramUserId,
        emailVerified: user.emailVerified,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLogin: new Date(),
        name: user.username
      };

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

  async verifyToken(token: string): Promise<{ success: boolean; message: string; user?: UserWithoutPassword }> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      });
      
      if (!user) {
        return { success: false, message: 'Usuário não encontrado' };
      }

      const userWithoutPassword: UserWithoutPassword = {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        telegramUserId: user.telegramUserId,
        emailVerified: user.emailVerified,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLogin: user.lastLogin,
        name: user.username
      };
      
      return { 
        success: true, 
        message: 'Token válido', 
        user: userWithoutPassword 
      };
    } catch (error) {
      return { success: false, message: 'Token inválido' };
    }
  }

  async getUserByTelegramId(telegramId: number): Promise<UserWithoutPassword | null> {
    try {
      const user = await prisma.user.findFirst({
        where: { telegramUserId: telegramId }
      });
      
      if (!user) return null;

      return {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        telegramUserId: user.telegramUserId,
        emailVerified: user.emailVerified,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLogin: user.lastLogin,
        name: user.username
      };
    } catch (error) {
      console.error('Erro ao buscar usuário por Telegram ID:', error);
      return null;
    }
  }

  async getAllUsers(): Promise<UserWithoutPassword[]> {
    try {
      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' }
      });
      
      return users.map(user => ({
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        telegramUserId: user.telegramUserId,
        emailVerified: user.emailVerified,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLogin: user.lastLogin,
        name: user.username
      }));
    } catch (error) {
      console.error('Erro ao buscar todos os usuários:', error);
      return [];
    }
  }

  // Métodos para recuperação de senha
  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string; token?: string }> {
    try {
      const user = await prisma.user.findUnique({
        where: { email }
      });
      
      if (!user) {
        // Por segurança, não revelar se o email existe
        return { success: true, message: 'Se o email existir, você receberá instruções para redefinir sua senha' };
      }

      const resetToken = this.generateToken();
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
      
      this.resetTokens.set(resetToken, {
        userId: user.id,
        expires
      });

      // TODO: Enviar email com o token
      console.log(`Reset token para ${email}: ${resetToken}`);
      
      return { 
        success: true, 
        message: 'Se o email existir, você receberá instruções para redefinir sua senha',
        token: resetToken // Em produção, remover isso
      };
    } catch (error) {
      console.error('Erro ao solicitar reset de senha:', error);
      return { success: false, message: 'Erro interno do servidor' };
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      const tokenData = this.resetTokens.get(token);
      
      if (!tokenData || tokenData.expires < new Date()) {
        return { success: false, message: 'Token inválido ou expirado' };
      }

      if (!this.isPasswordStrong(newPassword)) {
        return { 
          success: false, 
          message: 'Senha deve ter pelo menos 8 caracteres, incluindo maiúscula, minúscula, número e caractere especial' 
        };
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      await prisma.user.update({
        where: { id: tokenData.userId },
        data: { passwordHash: hashedPassword }
      });

      // Remover token usado
      this.resetTokens.delete(token);
      
      return { success: true, message: 'Senha redefinida com sucesso' };
    } catch (error) {
      console.error('Erro ao redefinir senha:', error);
      return { success: false, message: 'Erro interno do servidor' };
    }
  }

  // Métodos para verificação de email
  async requestEmailVerification(email: string): Promise<{ success: boolean; message: string; token?: string }> {
    try {
      const user = await prisma.user.findUnique({
        where: { email }
      });
      
      if (!user) {
        return { success: false, message: 'Usuário não encontrado' };
      }

      const verificationToken = this.generateToken();
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas
      
      this.verificationTokens.set(verificationToken, {
        userId: user.id,
        expires
      });

      // TODO: Enviar email com o token
      console.log(`Verification token para ${email}: ${verificationToken}`);
      
      return { 
        success: true, 
        message: 'Email de verificação enviado',
        token: verificationToken // Em produção, remover isso
      };
    } catch (error) {
      console.error('Erro ao solicitar verificação de email:', error);
      return { success: false, message: 'Erro interno do servidor' };
    }
  }

  async verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
    try {
      const tokenData = this.verificationTokens.get(token);
      
      if (!tokenData || tokenData.expires < new Date()) {
        return { success: false, message: 'Token inválido ou expirado' };
      }

      await prisma.user.update({
        where: { id: tokenData.userId },
        data: { emailVerified: true }
      });

      // Remover token usado
      this.verificationTokens.delete(token);
      
      return { success: true, message: 'Email verificado com sucesso' };
    } catch (error) {
      console.error('Erro ao verificar email:', error);
      return { success: false, message: 'Erro interno do servidor' };
    }
  }

  // Métodos para gerenciamento de perfil
  async getUserById(userId: string): Promise<UserWithoutPassword | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });
      
      if (!user) return null;

      return {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        telegramUserId: user.telegramUserId,
        emailVerified: user.emailVerified,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLogin: user.lastLogin,
        name: user.username
      };
    } catch (error) {
      console.error('Erro ao buscar usuário por ID:', error);
      return null;
    }
  }

  async updateProfile(userId: string, data: { name: string; email: string; telegramId?: string }): Promise<{ success: boolean; message: string; user?: UserWithoutPassword }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });
      
      if (!user) {
        return { success: false, message: 'Usuário não encontrado' };
      }

      // Verificar se o email já está em uso por outro usuário
      if (data.email !== user.email) {
        const emailExists = await prisma.user.findFirst({
          where: { 
            email: data.email,
            id: { not: userId }
          }
        });
        
        if (emailExists) {
          return { success: false, message: 'Este email já está em uso' };
        }
      }

      // Atualizar dados
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          email: data.email,
          username: data.name, // Usar name como username
          telegramUserId: data.telegramId ? parseInt(data.telegramId) : null
        }
      });

      const userWithoutPassword: UserWithoutPassword = {
        id: updatedUser.id,
        email: updatedUser.email,
        username: updatedUser.username,
        role: updatedUser.role,
        telegramUserId: updatedUser.telegramUserId,
        emailVerified: updatedUser.emailVerified,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        avatar: updatedUser.avatar,
        isActive: updatedUser.isActive,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
        lastLogin: updatedUser.lastLogin,
        name: updatedUser.username
      };
      
      return { 
        success: true, 
        message: 'Perfil atualizado com sucesso',
        user: userWithoutPassword 
      };
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      return { success: false, message: 'Erro interno do servidor' };
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });
      
      if (!user) {
        return { success: false, message: 'Usuário não encontrado' };
      }

      // Verificar senha atual
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
      
      if (!isCurrentPasswordValid) {
        return { success: false, message: 'Senha atual incorreta' };
      }

      // Validar nova senha
      if (!this.isPasswordStrong(newPassword)) {
        return { 
          success: false, 
          message: 'Nova senha deve ter pelo menos 8 caracteres, incluindo maiúscula, minúscula, número e caractere especial' 
        };
      }

      // Verificar se a nova senha é diferente da atual
      const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
      
      if (isSamePassword) {
        return { success: false, message: 'A nova senha deve ser diferente da senha atual' };
      }

      // Atualizar senha
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: hashedNewPassword }
      });
      
      return { success: true, message: 'Senha alterada com sucesso' };
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      return { success: false, message: 'Erro interno do servidor' };
    }
  }
}

export default DatabaseAuthService;