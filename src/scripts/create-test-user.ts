import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    // Verificar se já existe um usuário de teste por email
    const existingUserByEmail = await prisma.user.findUnique({
      where: { email: 'test@example.com' }
    });

    // Verificar se já existe um usuário de teste por username
    const existingUserByUsername = await prisma.user.findUnique({
      where: { username: 'testuser' }
    });

    if (existingUserByEmail || existingUserByUsername) {
      console.log('✅ Usuário de teste já existe:');
      console.log('Email: test@example.com');
      console.log('Senha: 123456');
      return;
    }

    // Criar hash da senha
    const passwordHash = await bcrypt.hash('123456', 10);

    // Criar usuário de teste
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: passwordHash,
        firstName: 'Test',
        lastName: 'User',
        emailVerified: true,
        isActive: true,
        role: 'USER'
      }
    });

    console.log('✅ Usuário de teste criado com sucesso!');
    console.log('Email: test@example.com');
    console.log('Senha: 123456');
    console.log('ID:', user.id);

  } catch (error) {
    console.error('❌ Erro ao criar usuário de teste:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();