import { PrismaClient } from '@prisma/client'

declare global {
  var prismaGlobal: PrismaClient | undefined
}

export const getPrisma = (): PrismaClient => {
  if (!globalThis.prismaGlobal) {
    globalThis.prismaGlobal = new PrismaClient({
      log: ['error', 'warn'],
    })
  }
  return globalThis.prismaGlobal
}
