// Prisma 7 Configuration File (Plain JS for maximum compatibility)
module.exports = {
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL || "postgresql://postgres:postgres@db:5432/aggregateapi?schema=public",
  },
};
