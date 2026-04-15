import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { firebaseUid: 'demo_user' } });
  if (!user) {
    console.log('demo_user not found in DB');
  } else {
    const deleted = await prisma.like.deleteMany({ where: { senderId: user.id } });
    console.log(`✓ Cleared ${deleted.count} like(s) for demo_user — all test profiles will reappear.`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
