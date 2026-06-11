-- Drop the old select policy on rooms
drop policy if exists "Allow select access to room members" on public.rooms;

-- Recreate with an explicit check for the owner, allowing INSERT ... RETURNING to succeed
create policy "Allow select access to room members or owners"
  on public.rooms for select
  to authenticated
  using (
    -- Room owner can always view/select the room
    (owner_id = auth.uid())
    or
    -- Collaborators can view/select the room
    exists (
      select 1 from public.room_members
      where room_members.room_id = id
      and room_members.user_id = auth.uid()
    )
  );
