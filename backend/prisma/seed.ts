import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Admin@123", 10);

  await prisma.user.upsert({
    where: { email: "admin@scheduler.local" },
    update: {},
    create: {
      email: "admin@scheduler.local",
      passwordHash,
      name: "Admin",
      role: Role.ADMIN,
    },
  });

  console.log("✅ Seed complete: admin@scheduler.local / Admin@123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });