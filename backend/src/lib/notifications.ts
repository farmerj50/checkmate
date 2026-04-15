import admin from 'firebase-admin';
import { prisma } from './prisma';

interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Send a push notification to a single user by their DB user id.
 * Silently no-ops if Firebase Admin isn't initialized or user has no FCM token.
 */
export async function sendPushToUser(userId: string, payload: NotificationPayload) {
  // Only send if Firebase Admin is active
  if (!admin.apps.length || !admin.app().options.projectId) return;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });
    if (!user?.fcmToken) return;

    await admin.messaging().send({
      token: user.fcmToken,
      notification: { title: payload.title, body: payload.body },
      data: payload.data,
      apns: { payload: { aps: { badge: 1, sound: 'default' } } },
      android: { priority: 'high', notification: { sound: 'default' } },
    });
  } catch (err: any) {
    // Token may be stale — clear it so we don't keep hitting a dead token
    if (err.code === 'messaging/registration-token-not-registered') {
      await prisma.user.updateMany({ where: { id: userId }, data: { fcmToken: null } });
    } else {
      console.warn('Push notification failed:', err.message);
    }
  }
}

export async function notifyNewMatch(userId: string, matchedWithName: string) {
  await sendPushToUser(userId, {
    title: "It's a Match! 🎉",
    body: `You and ${matchedWithName} liked each other!`,
    data: { type: 'match' },
  });
}

export async function notifyNewMessage(
  receiverId: string,
  senderName: string,
  messagePreview: string,
  matchId: string
) {
  await sendPushToUser(receiverId, {
    title: senderName,
    body: messagePreview.length > 60 ? messagePreview.slice(0, 57) + '…' : messagePreview,
    data: { type: 'message', matchId },
  });
}
