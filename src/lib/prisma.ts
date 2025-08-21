// Re-export prisma from db.ts for compatibility
export { prisma, testDatabaseConnection, disconnectDatabase } from './db';
export { PrismaClient } from '@prisma/client';