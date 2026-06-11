-- Create strokes table
create table public.strokes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  points jsonb not null, -- Array of Point object {x, y}
  color text not null,
  width numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.strokes enable row level security;

-- Policies
create policy "Allow select access to room strokes"
  on public.strokes for select
  to authenticated
  using (
    exists (
      select 1 from public.room_members
      where room_members.room_id = strokes.room_id
        and room_members.user_id = auth.uid()
    )
  );

create policy "Allow insert access to room strokes"
  on public.strokes for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.room_members
      where room_members.room_id = strokes.room_id
        and room_members.user_id = auth.uid()
    )
  );

create policy "Allow delete access to room strokes"
  on public.strokes for delete
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.rooms
      where rooms.id = strokes.room_id
        and rooms.owner_id = auth.uid()
    )
  );
