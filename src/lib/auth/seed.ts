import { prisma } from '../db';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';

export async function seedDefaultUsers() {
  try {
    // Verificar se já existe um usuário admin
    const existingAdmin = await prisma.user.findFirst({
      where: { role: Role.ADMIN }
    });

    if (existingAdmin) {
      console.log('Usuário admin já existe');
      return;
    }

    // Criar usuário admin padrão
    const hashedPassword = await bcrypt.hash('Admin123!', 10);
    
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@autosheets.com',
        username: 'admin',
        passwordHash: hashedPassword,
        role: Role.ADMIN,
        emailVerified: true,
        firstName: 'Admin',
        lastName: 'User'
      }
    });

    console.log('Usuário admin criado:', {
      id: adminUser.id,
      email: adminUser.email,
      username: adminUser.username,
      role: adminUser.role
    });

    // Criar usuário de teste
    const testUserPassword = await bcrypt.hash('Test123!', 10);
    
    const testUser = await prisma.user.create({
      data: {
        email: 'test@autosheets.com',
        username: 'testuser',
        passwordHash: testUserPassword,
        role: Role.USER,
        emailVerified: true,
        firstName: 'Test',
        lastName: 'User'
      }
    });

    console.log('Usuário de teste criado:', {
      id: testUser.id,
      email: testUser.email,
      username: testUser.username,
      role: testUser.role
    });

  } catch (error) {
    console.error('Erro ao criar usuários padrão:', error);
  }
}

// Executar seed se chamado diretamente
if (require.main === module) {
  seedDefaultUsers()
    .then(() => {
      console.log('Seed concluído');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Erro no seed:', error);
      process.exit(1);
    });
}