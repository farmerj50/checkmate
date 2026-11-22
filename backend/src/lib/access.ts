import { Prisma, Post } from '@prisma/client';
import { prisma } from './prisma';

export function visibleUserWhere(viewerId: string): Prisma.UserWhereInput {
  const adultCutoff = new Date();
  adultCutoff.setUTCFullYear(adultCutoff.getUTCFullYear() - 18);
  return {
    isActive: true,
    dateOfBirth: { lte: adultCutoff },
    NOT: [
      { blocks: { some: { blockedId: viewerId } } },
      { blockedBy: { some: { blockerId: viewerId } } },
    ],
  };
}

export function activeUserIdentityWhere(firebaseUid: string): Prisma.UserWhereUniqueInput {
  const adultCutoff = new Date();
  adultCutoff.setUTCFullYear(adultCutoff.getUTCFullYear() - 18);
  return { firebaseUid, isActive: true, dateOfBirth: { lte: adultCutoff } };
}

export function canViewPost(post: Pick<Post, 'authorId' | 'isDeleted' | 'visibility' | 'moderationStatus'>, viewerId: string) {
  return !post.isDeleted && post.moderationStatus !== 'REJECTED' &&
    (post.visibility !== 'PRIVATE' || post.authorId === viewerId);
}

export function visiblePostWhere(viewerId: string): Prisma.PostWhereInput {
  return {
    isDeleted: false, moderationStatus: { not: 'REJECTED' }, author: visibleUserWhere(viewerId),
    OR: [{ visibility: 'PUBLIC' }, { authorId: viewerId }],
  };
}

export function accessibleMatchWhere(userId: string, matchId?: string): Prisma.MatchWhereInput {
  return {
    ...(matchId ? { id: matchId } : {}), isActive: true,
    OR: [{ user1Id: userId }, { user2Id: userId }],
    user1: visibleUserWhere(userId), user2: visibleUserWhere(userId),
  };
}

export async function getAccessibleMatch(userId: string, matchId: string) {
  return prisma.match.findFirst({ where: accessibleMatchWhere(userId, matchId) });
}

export async function blockUser(blockerId: string, blockedId: string) {
  return prisma.$transaction(async tx => {
    const block = await tx.block.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      update: {}, create: { blockerId, blockedId },
    });
    await tx.match.updateMany({
      where: { OR: [{ user1Id: blockerId, user2Id: blockedId }, { user1Id: blockedId, user2Id: blockerId }] },
      data: { isActive: false },
    });
    await tx.follow.deleteMany({
      where: { OR: [{ followerId: blockerId, followingId: blockedId }, { followerId: blockedId, followingId: blockerId }] },
    });
    return block;
  });
}
