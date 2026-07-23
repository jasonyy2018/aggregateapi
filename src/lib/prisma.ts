import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

declare global {
  var prismaGlobal: PrismaClient | undefined
}

export const getPrisma = (): PrismaClient => {
  if (!globalThis.prismaGlobal) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is required");
    }
    const connectionString = process.env.DATABASE_URL;
    const pool = new Pool({ connectionString, max: 20 });
    const adapter = new PrismaPg(pool);

    globalThis.prismaGlobal = new PrismaClient({
      adapter, // Explicitly provide the adapter for Prisma 7
      log: ['error', 'warn'],
    })
  }
  return globalThis.prismaGlobal
}
