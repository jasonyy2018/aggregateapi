import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient({
  datasourceUrl: "postgresql://postgres:postgres@localhost:5432/aggregateapi?schema=public"
})

async function main() {
  const email = "admin@aggregateapi.com"
  const password = "admin"
  
  const existingAdmin = await prisma.user.findUnique({
    where: { email }
  })

  if (existingAdmin) {
    console.log("Admin account already exists.")
    return
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name: "Platform Admin",
      role: "ADMIN",
      balance: 99999.0, // Preload
      emailVerified: new Date()
    }
  })

  console.log(`Admin account created! Email: ${email} | Password: ${password}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
