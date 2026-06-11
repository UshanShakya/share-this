export interface Room {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface RoomMember {
  room_id: string;
  user_id: string;
  joined_at: string;
  status?: 'pending' | 'accepted';
  profiles?: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

export interface RoomInvite {
  room_id: string;
  joined_at: string;
  room: {
    id: string;
    name: string;
    owner_id: string;
    owner_profile?: {
      username: string | null;
      display_name: string | null;
    } | null;
  };
}

export interface RoomState {
  rooms: Room[];
  activeRoom: Room | null;
  activeRoomMembers: RoomMember[];
  roomInvites: RoomInvite[];
  isLoading: boolean;
  error: string | null;
  fetchRooms: () => Promise<void>;
  fetchRoomInvites: () => Promise<void>;
  acceptRoomInvite: (roomId: string) => Promise<{ success: boolean; error?: string }>;
  declineRoomInvite: (roomId: string) => Promise<{ success: boolean; error?: string }>;
  createRoom: (name: string) => Promise<Room | null>;
  fetchMembers: (roomId: string) => Promise<void>;
  inviteMember: (roomId: string, username: string) => Promise<{ success: boolean; error?: string }>;
  leaveRoom: (roomId: string) => Promise<{ success: boolean; error?: string }>;
  deleteRoom: (roomId: string) => Promise<{ success: boolean; error?: string }>;
  removeMember: (roomId: string, userId: string) => Promise<{ success: boolean; error?: string }>;
  setActiveRoom: (room: Room | null) => void;
  clearActiveRoom: () => void;
}

