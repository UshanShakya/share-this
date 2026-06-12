-- Enable Realtime for rooms, room_members, and friends tables
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.room_members;
alter publication supabase_realtime add table public.friends;
