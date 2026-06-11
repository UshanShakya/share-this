import { useRoomStore } from '../store/roomStore';

export const useRoom = () => {
  const {
    rooms,
    activeRoom,
    activeRoomMembers,
    roomInvites,
    isLoading,
    error,
    fetchRooms,
    fetchRoomInvites,
    acceptRoomInvite,
    declineRoomInvite,
    createRoom,
    fetchMembers,
    inviteMember,
    leaveRoom,
    deleteRoom,
    removeMember,
    setActiveRoom,
    clearActiveRoom,
  } = useRoomStore();

  return {
    rooms,
    activeRoom,
    activeRoomMembers,
    roomInvites,
    isLoading,
    error,
    fetchRooms,
    fetchRoomInvites,
    acceptRoomInvite,
    declineRoomInvite,
    createRoom,
    fetchMembers,
    inviteMember,
    leaveRoom,
    deleteRoom,
    removeMember,
    setActiveRoom,
    clearActiveRoom,
  };
};

export default useRoom;
