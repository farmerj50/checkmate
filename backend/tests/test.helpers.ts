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
  const database = new URL(process.env.TEST_DATABASE_URL ?? 'file:missing');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(database.hostname) ||
      !database.pathname.toLowerCase().includes('test') || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
    throw new Error('Fixture cleanup requires an explicitly configured local test database');
  }
  const testUsers = await prisma.user.findMany({
    where: { firebaseUid: { in: [A, B, C] } },
    select: { id: true },
  });
  const testUserIds = testUsers.map((user) => user.id);

  if (testUserIds.length > 0) {
    await prisma.savedPost.deleteMany({
      where: { OR: [{ userId: { in: testUserIds } }, { post: { authorId: { in: testUserIds } } }] },
    }).catch(() => null);
    await prisma.postReaction.deleteMany({
      where: { OR: [{ userId: { in: testUserIds } }, { post: { authorId: { in: testUserIds } } }] },
    });
    await prisma.follow.deleteMany({
      where: { OR: [{ followerId: { in: testUserIds } }, { followingId: { in: testUserIds } }] },
    });
    await prisma.block.deleteMany({
      where: { OR: [{ blockerId: { in: testUserIds } }, { blockedId: { in: testUserIds } }] },
    });
    await prisma.report.deleteMany({
      where: { OR: [{ reporterId: { in: testUserIds } }, { reportedId: { in: testUserIds } }] },
    });
    await prisma.notification.deleteMany({
      where: { OR: [{ userId: { in: testUserIds } }, { actorId: { in: testUserIds } }] },
    });
    await prisma.userPrompt.deleteMany({ where: { userId: { in: testUserIds } } }).catch(() => null);
    await prisma.profileView.deleteMany({
      where: { OR: [{ viewerId: { in: testUserIds } }, { viewedId: { in: testUserIds } }] },
    }).catch(() => null);
    await prisma.post.deleteMany({ where: { authorId: { in: testUserIds } } });
  }

  await prisma.user.deleteMany({ where: { firebaseUid: { in: [A, B, C] } } });
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
