import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, firebaseUid: true, firstName: true, email: true, isActive: true },
  });
  console.log(`Total users: ${users.length}`);
  users.forEach(u => console.log(`  [${u.firebaseUid}] ${u.firstName} <${u.email}> active=${u.isActive}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
