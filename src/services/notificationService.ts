import { db, functions } from '../config/firebase';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { type AppNotification } from '../types/incrementStory';

export const getNotifications = (uid: string, callback: (notifications: AppNotification[]) => void) => {
  const q = query(
    collection(db, 'users', uid, 'notifications'),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AppNotification));
    callback(notifications);
  });
};

export const markNotificationRead = async (notificationId: string): Promise<void> => {
  const markRead = httpsCallable<{ notificationId: string }, { success: boolean }>(functions, 'markNotificationRead');
  await markRead({ notificationId });
};

export const markAllNotificationsRead = async (): Promise<void> => {
  const markAllRead = httpsCallable<void, { success: boolean, count: number }>(functions, 'markAllNotificationsRead');
  await markAllRead();
};
