import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    // Optional: Log database queries during development
    log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

export default prisma;