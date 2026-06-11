import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';
import { Room, RoomState, RoomInvite } from '../types/room';
import { useNotificationStore } from './notificationStore';
import { useAuthStore } from './authStore';

export const useRoomStore = create<RoomState>((set, get) => ({
  rooms: [],
  activeRoom: null,
  activeRoomMembers: [],
  roomInvites: [],
  isLoading: false,
  error: null,

  setActiveRoom: (room) => set({ activeRoom: room }),
  clearActiveRoom: () => set({ activeRoom: null, activeRoomMembers: [] }),

  fetchRooms: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User is not authenticated.');

      // Handled automatically by RLS select policy, inner join room_members filter accepted status
      const { data, error } = await supabase
        .from('rooms')
        .select(`
          *,
          room_members!inner(user_id, status)
        `)
        .eq('room_members.user_id', user.id)
        .eq('room_members.status', 'accepted')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Map out the room_members field added by inner join
      const mappedRooms = (data || []).map((r: any) => {
        const { room_members, ...roomRest } = r;
        return roomRest as Room;
      });

      set({ rooms: mappedRooms });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch rooms.' });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchRoomInvites: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User is not authenticated.');

      // 1. Fetch pending memberships for the user
      const { data: membershipData, error: membershipErr } = await supabase
        .from('room_members')
        .select('room_id, joined_at')
        .eq('user_id', user.id)
        .eq('status', 'pending');

      if (membershipErr) throw membershipErr;
      if (!membershipData || membershipData.length === 0) {
        set({ roomInvites: [] });
        return;
      }

      // 2. Fetch rooms details for these memberships
      const roomIds = membershipData.map((m) => m.room_id);
      const { data: roomData, error: roomErr } = await supabase
        .from('rooms')
        .select('*')
        .in('id', roomIds);

      if (roomErr) throw roomErr;

      // 3. Fetch owner profiles for these rooms
      const ownerIds = (roomData || []).map((r) => r.owner_id);
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .in('id', ownerIds);

      if (profileErr) throw profileErr;

      const profileMap = new Map<string, any>();
      profileData?.forEach((p) => profileMap.set(p.id, p));

      const roomMap = new Map<string, any>();
      roomData?.forEach((r) => {
        const ownerProfile = profileMap.get(r.owner_id) || null;
        roomMap.set(r.id, {
          ...r,
          owner_profile: ownerProfile,
        });
      });

      const invites: RoomInvite[] = membershipData.map((m) => ({
        room_id: m.room_id,
        joined_at: m.joined_at,
        room: roomMap.get(m.room_id),
      })).filter((invite) => invite.room !== undefined);

      set({ roomInvites: invites });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch room invitations.' });
    } finally {
      set({ isLoading: false });
    }
  },

  acceptRoomInvite: async (roomId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User is not authenticated.');

      const { error } = await supabase
        .from('room_members')
        .update({ status: 'accepted' })
        .eq('room_id', roomId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Remove from invites list and fetch rooms to update active list
      set((state) => ({
        roomInvites: state.roomInvites.filter((invite) => invite.room_id !== roomId),
      }));
      
      await get().fetchRooms();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to accept invitation.' };
    }
  },

  declineRoomInvite: async (roomId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User is not authenticated.');

      const { error } = await supabase
        .from('room_members')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Remove from invites list
      set((state) => ({
        roomInvites: state.roomInvites.filter((invite) => invite.room_id !== roomId),
      }));

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to decline invitation.' };
    }
  },

  createRoom: async (name: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User is not authenticated.');

      const { data, error } = await supabase
        .from('rooms')
        .insert({
          name: name.trim(),
          owner_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      const newRoom = data as Room;
      
      // Update local store state
      set((state) => ({
        rooms: [newRoom, ...state.rooms],
        activeRoom: newRoom,
      }));

      return newRoom;
    } catch (err: any) {
      set({ error: err.message || 'Failed to create room.' });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  fetchMembers: async (roomId: string) => {
    set({ isLoading: true, error: null });
    try {
      // Query junction table and join with user profiles
      const { data, error } = await supabase
        .from('room_members')
        .select(`
          room_id,
          user_id,
          joined_at,
          status,
          profiles (
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('room_id', roomId);

      if (error) throw error;
      set({ activeRoomMembers: data as any[] });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch room members.' });
    } finally {
      set({ isLoading: false });
    }
  },

  inviteMember: async (roomId: string, username: string) => {
    try {
      // 1. Search for user profile by username
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.toLowerCase().trim())
        .single();

      if (profileErr || !profileData) {
        throw new Error(`User with username "${username}" not found.`);
      }

      // 2. Insert user into room_members
      const { error: insertErr } = await supabase
        .from('room_members')
        .insert({
          room_id: roomId,
          user_id: profileData.id,
          status: 'pending',
        });

      if (insertErr) {
        if (insertErr.code === '23505') {
          throw new Error('User is already a member of this room.');
        }
        throw insertErr;
      }

      // Send room invite notification
      try {
        const inviterProfile = useAuthStore.getState().profile;
        const inviterName = inviterProfile?.display_name || inviterProfile?.username || 'Someone';
        const roomName = get().rooms.find((r) => r.id === roomId)?.name || get().activeRoom?.name || 'a canvas';
        
        await useNotificationStore.getState().addNotification(
          profileData.id,
          'Canvas Invite',
          `${inviterName} has invited you to join the canvas room "${roomName}".`,
          'room_invite',
          roomId
        );
      } catch (notifErr) {
        console.warn('Failed to send invite notification:', notifErr);
      }

      // 3. Hydrate member list again in local state
      await get().fetchMembers(roomId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to invite user.' };
    }
  },

  leaveRoom: async (roomId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User is not authenticated.');

      const { error } = await supabase
        .from('room_members')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Remove the room from local state lists
      set((state) => ({
        rooms: state.rooms.filter((r) => r.id !== roomId),
        activeRoom: state.activeRoom?.id === roomId ? null : state.activeRoom,
      }));

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to leave room.' };
    }
  },

  deleteRoom: async (roomId: string) => {
    try {
      const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('id', roomId);

      if (error) throw error;

      // Remove the room from local state lists
      set((state) => ({
        rooms: state.rooms.filter((r) => r.id !== roomId),
        activeRoom: state.activeRoom?.id === roomId ? null : state.activeRoom,
      }));

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to delete room.' };
    }
  },

  removeMember: async (roomId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('room_members')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', userId);

      if (error) throw error;

      // Update the active members list locally
      set((state) => ({
        activeRoomMembers: state.activeRoomMembers.filter((m) => m.user_id !== userId),
      }));

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to remove member.' };
    }
  },
}));

export default useRoomStore;
