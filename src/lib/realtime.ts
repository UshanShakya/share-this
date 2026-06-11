import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { useCanvasStore } from '../store/canvasStore';
import { Point, Stroke, ToolType } from '../types/canvas';

export interface Collaborator {
  userId: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
}

let currentChannel: RealtimeChannel | null = null;

export const realtimeService = {
  joinRoom: async (
    roomId: string,
    userId: string,
    onPresenceChange: (users: Collaborator[]) => void
  ): Promise<RealtimeChannel> => {
    if (currentChannel) {
      currentChannel.unsubscribe();
    }

    const store = useCanvasStore.getState();

    // Create the channel
    const channel = supabase.channel(`room:${roomId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: userId },
      },
    });

    // Subscribe to presence updates
    channel.on('presence', { event: 'sync' }, () => {
      const presenceState = channel.presenceState();
      const collaborators: Collaborator[] = [];
      
      Object.keys(presenceState).forEach((key) => {
        const presences = presenceState[key] as any[];
        if (presences && presences.length > 0) {
          collaborators.push({
            userId: presences[0].userId,
            username: presences[0].username,
            display_name: presences[0].display_name,
            avatar_url: presences[0].avatar_url || null,
          });
        }
      });
      
      onPresenceChange(collaborators);
    });

    channel.on('presence', { event: 'leave' }, ({ key }) => {
      store.clearRemoteActiveStroke(key);
    });

    // Listen for broadcast drawing events
    channel.on('broadcast', { event: 'draw' }, ({ payload }) => {
      const { userId, points, color, width, tool } = payload;
      store.setRemoteActiveStroke(userId, points, color, width, tool);
    });

    channel.on('broadcast', { event: 'draw-end' }, ({ payload }) => {
      const { userId, stroke } = payload;
      store.clearRemoteActiveStroke(userId);
      store.addStroke(stroke);
    });

    channel.on('broadcast', { event: 'undo' }, ({ payload }) => {
      const { strokeId } = payload;
      useCanvasStore.setState((state) => ({
        strokes: state.strokes.filter((s) => s.id !== strokeId),
      }));
    });

    channel.on('broadcast', { event: 'clear' }, () => {
      store.clearStrokes();
    });

    // Subscribe channel
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // Fetch user's profile info
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, display_name, avatar_url')
          .eq('id', userId)
          .single();

        channel.track({
          userId,
          username: profile?.username || 'user',
          display_name: profile?.display_name || 'Anonymous',
          avatar_url: profile?.avatar_url || null,
        });
      }
    });

    currentChannel = channel;
    return channel;
  },

  leaveRoom: () => {
    if (currentChannel) {
      currentChannel.unsubscribe();
      currentChannel = null;
    }
  },

  broadcastDraw: (userId: string, points: Point[], color: string, width: number, tool: ToolType) => {
    if (currentChannel) {
      currentChannel.send({
        type: 'broadcast',
        event: 'draw',
        payload: { userId, points, color, width, tool },
      });
    }
  },

  broadcastDrawEnd: (userId: string, stroke: Stroke) => {
    if (currentChannel) {
      currentChannel.send({
        type: 'broadcast',
        event: 'draw-end',
        payload: { userId, stroke },
      });
    }
  },

  broadcastUndo: (strokeId: string) => {
    if (currentChannel) {
      currentChannel.send({
        type: 'broadcast',
        event: 'undo',
        payload: { strokeId },
      });
    }
  },

  broadcastClear: () => {
    if (currentChannel) {
      currentChannel.send({
        type: 'broadcast',
        event: 'clear',
        payload: {},
      });
    }
  },
};
