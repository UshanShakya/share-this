-- Drop the recursive select policy on room_members
drop policy if exists "Allow select access to active room members" on public.room_members;

-- Recreate with a non-recursive policy
create policy "Allow select access to active room members"
  on public.room_members for select
  to authenticated
  using (
    -- Base case: Users can always see their own membership row (terminates recursion)
    (auth.uid() = user_id)
    or
    -- General case: Users can see memberships of rooms they belong to (evaluated via rooms RLS policy)
    exists (
      select 1 from public.rooms
      where rooms.id = room_id
    )
  );
