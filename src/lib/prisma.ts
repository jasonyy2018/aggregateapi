import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

declare global {
  var prismaGlobal: PrismaClient | undefined
}

export const getPrisma = (): PrismaClient => {
  if (!globalThis.prismaGlobal) {
    const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/aggregateapi?schema=public";
    
    // Create a PG pool and the PrismaPg adapter
    const pool = new Pool({ connectionString })
    const adapter = new PrismaPg(pool)

    globalThis.prismaGlobal = new PrismaClient({
      adapter, // Explicitly provide the adapter for Prisma 7
      log: ['error', 'warn'],
    })
  }
  return globalThis.prismaGlobal
}
