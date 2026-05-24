import { PrismaClient } from "@prisma/client";
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/aggregateapi?schema=public";
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error', 'warn'] });

async function main() {
  const providers = await prisma.provider.findMany();
  console.log("Providers in DB:");
  console.log(JSON.stringify(providers, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
