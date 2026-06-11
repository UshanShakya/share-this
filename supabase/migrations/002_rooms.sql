-- Create rooms table
create table public.rooms (
  id uuid default gen_random_uuid() primary key,
  name text not null check (char_length(name) >= 1 and char_length(name) <= 40),
  owner_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on rooms
alter table public.rooms enable row level security;

-- Create room members table
create table public.room_members (
  room_id uuid references public.rooms(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (room_id, user_id)
);

-- Enable RLS on room_members
alter table public.room_members enable row level security;

-- Database Trigger: Automatically add room owner to room_members upon creation
create or replace function public.handle_new_room()
returns trigger as $$
begin
  insert into public.room_members (room_id, user_id)
  values (new.id, new.owner_id);
  return new;
exception
  when others then
    -- Fail safe
    return new;
end;
$$ language plpgsql security definer;

create trigger on_room_created
  after insert on public.rooms
  for each row execute procedure public.handle_new_room();

-- RLS Policies for public.rooms
create policy "Allow select access to room members"
  on public.rooms for select
  to authenticated
  using (
    exists (
      select 1 from public.room_members
      where room_members.room_id = id
      and room_members.user_id = auth.uid()
    )
  );

create policy "Allow insert access to authenticated users"
  on public.rooms for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Allow update access to room owners"
  on public.rooms for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Allow delete access to room owners"
  on public.rooms for delete
  to authenticated
  using (owner_id = auth.uid());

-- RLS Policies for public.room_members
create policy "Allow select access to active room members"
  on public.room_members for select
  to authenticated
  using (
    exists (
      select 1 from public.room_members as rm
      where rm.room_id = room_members.room_id
      and rm.user_id = auth.uid()
    )
  );

create policy "Allow insert access to owners or self-joining users"
  on public.room_members for insert
  to authenticated
  with check (
    -- Let users add themselves (join room via link)
    (auth.uid() = user_id)
    or
    -- Or allow the owner of the room to add collaborators
    exists (
      select 1 from public.rooms
      where rooms.id = room_id
      and rooms.owner_id = auth.uid()
    )
  );

create policy "Allow delete access to members leaving or owners removing members"
  on public.room_members for delete
  to authenticated
  using (
    -- Members can leave
    (auth.uid() = user_id)
    or
    -- Owners can remove members
    exists (
      select 1 from public.rooms
      where rooms.id = room_id
      and rooms.owner_id = auth.uid()
    )
  );
