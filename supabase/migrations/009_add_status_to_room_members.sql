-- Add status column to room_members
alter table public.room_members
add column status text not null default 'accepted' check (status in ('pending', 'accepted'));

-- Create update policy on room_members for accepting invites
create policy "Allow update access to members accepting invites"
  on public.room_members for update
  to authenticated
  using (auth.uid() = user_id)
  with check (status = 'accepted');
