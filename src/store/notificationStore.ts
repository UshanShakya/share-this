import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';
import { AppNotification } from '../types/notification';

let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
} catch (err) {
  console.warn('[Notifications] Failed to load expo-notifications in notificationStore:', err);
}

import { sharedStorage } from '../lib/sharedStorage';
import { useRoomStore } from './roomStore';

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;

  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  addNotification: (
    targetUserId: string,
    title: string,
    message: string,
    type: AppNotification['type'],
    relatedId?: string | null
  ) => Promise<{ success: boolean; error?: string }>;
  subscribeNotifications: (userId: string) => () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => {
  let activeSubscription: any = null;

  return {
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    error: null,

    fetchNotifications: async () => {
      set({ isLoading: true, error: null });
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User is not authenticated.');

        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const notificationsList = (data || []) as AppNotification[];
        const unread = notificationsList.filter((n) => !n.is_read).length;

        set({
          notifications: notificationsList,
          unreadCount: unread,
        });
      } catch (err: any) {
        set({ error: err.message || 'Failed to fetch notifications.' });
      } finally {
        set({ isLoading: false });
      }
    },

    markAsRead: async (id) => {
      try {
        const { error } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', id);

        if (error) throw error;

        set((state) => {
          const updated = state.notifications.map((n) =>
            n.id === id ? { ...n, is_read: true } : n
          );
          const unread = updated.filter((n) => !n.is_read).length;
          return {
            notifications: updated,
            unreadCount: unread,
          };
        });
      } catch (err) {
        console.error('Error marking notification as read:', err);
      }
    },

    deleteNotification: async (id) => {
      try {
        const { error } = await supabase
          .from('notifications')
          .delete()
          .eq('id', id);

        if (error) throw error;

        set((state) => {
          const updated = state.notifications.filter((n) => n.id !== id);
          const unread = updated.filter((n) => !n.is_read).length;
          return {
            notifications: updated,
            unreadCount: unread,
          };
        });
      } catch (err) {
        console.error('Error deleting notification:', err);
      }
    },

    markAllAsRead: async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', user.id)
          .eq('is_read', false);

        if (error) throw error;

        set((state) => {
          const updated = state.notifications.map((n) => ({ ...n, is_read: true }));
          return {
            notifications: updated,
            unreadCount: 0,
          };
        });
      } catch (err) {
        console.error('Error marking all notifications as read:', err);
      }
    },

    addNotification: async (targetUserId, title, message, type, relatedId = null) => {
      try {
        const { error } = await supabase
          .from('notifications')
          .insert({
            user_id: targetUserId,
            title,
            message,
            type,
            related_id: relatedId,
            is_read: false,
          });

        if (error) throw error;
        return { success: true };
      } catch (err: any) {
        console.error('Error adding notification:', err.message || err);
        return { success: false, error: err.message || 'Failed to create notification.' };
      }
    },

    subscribeNotifications: (userId) => {
      // Unsubscribe any existing subscription
      if (activeSubscription) {
        activeSubscription.unsubscribe();
      }

      // Create new Realtime channel for user notifications
      const channel = supabase.channel(`notifications:${userId}`, {
        config: {
          broadcast: { self: false },
        },
      });

      channel
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload: any) => {
            // Re-fetch notifications whenever a change is detected
            get().fetchNotifications();

            // Refresh local room states instantly
            useRoomStore.getState().fetchRooms().catch(() => {});
            useRoomStore.getState().fetchRoomInvites().catch(() => {});

            // Trigger system local notifications and widget reload on INSERT event
            if (payload.eventType === 'INSERT') {
              const newRecord = payload.new;
              
              if (Notifications) {
                Notifications.scheduleNotificationAsync({
                  content: {
                    title: newRecord.title || 'Knoodle Update',
                    body: newRecord.message || 'Someone updated your shared canvas!',
                    data: {
                      type: newRecord.type,
                      relatedId: newRecord.related_id,
                    },
                  },
                  trigger: null,
                }).catch((err: any) => {
                  console.warn('[subscribeNotifications] Failed to schedule notification:', err);
                });
              }

              // Instantly reload widget image with latest DB changes
              sharedStorage.reloadWidget();
            }
          }
        )
        .subscribe();

      activeSubscription = channel;

      // Return unsubscribe cleanup function
      return () => {
        if (channel) {
          channel.unsubscribe();
        }
        if (activeSubscription === channel) {
          activeSubscription = null;
        }
      };
    },
  };
});

export default useNotificationStore;
