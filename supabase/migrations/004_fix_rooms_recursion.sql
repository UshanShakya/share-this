-- Drop the previous select policy on room_members
drop policy if exists "Allow select access to active room members" on public.room_members;

-- Recreate with a simple true check for authenticated users to break the RLS recursion loop
create policy "Allow select access to active room members"
  on public.room_members for select
  to authenticated
  using (true);
