import { prisma } from '../src/lib/prisma';
import request from 'supertest';
import app from '../src/server';

export const A = 'demo_alice';
export const B = 'demo_bob';
export const C = 'demo_charlie';

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function resetDb() {
  await prisma.postReaction.deleteMany();
  await prisma.post.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.block.deleteMany();
  await prisma.report.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.userPrompt.deleteMany().catch(() => null);
  await prisma.profileView.deleteMany().catch(() => null);
  await prisma.user.deleteMany();
}

export async function createUser(token: string, name: string) {
  await prisma.user.createMany({
    data: [{
      firebaseUid: token,
      email: `${token}@example.test`,
      firstName: name,
      lastName: 'Test',
      dateOfBirth: new Date(1990,0,1),
      gender: 'OTHER' as any,
      location: 'Testville',
      profilePictures: [],
      profileVideos: [],
      lookingFor: 'FRIENDSHIP' as any,
    }],
    skipDuplicates: true,
  });
  return prisma.user.findUnique({ where: { firebaseUid: token } });
}

export { request, app };
