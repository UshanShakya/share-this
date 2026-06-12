-- Drop the foreign key constraint on room_members.user_id that references auth.users
alter table public.room_members
  drop constraint if exists room_members_user_id_fkey;

-- Add the new foreign key constraint on room_members.user_id that references public.profiles
alter table public.room_members
  add constraint room_members_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
