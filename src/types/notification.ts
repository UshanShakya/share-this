export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'friend_request' | 'room_invite' | 'canvas_update' | 'room_update';
  related_id?: string | null;
  is_read: boolean;
  created_at: string;
}
