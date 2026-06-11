-- Create friends table
create table public.friends (
  user_id uuid references auth.users(id) on delete cascade not null,
  friend_id uuid references auth.users(id) on delete cascade not null,
  status text not null check (status in ('pending', 'accepted')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, friend_id)
);

-- Enable RLS
alter table public.friends enable row level security;

-- Policies
create policy "Allow select access to own friendships"
  on public.friends for select
  to authenticated
  using (auth.uid() = user_id or auth.uid() = friend_id);

create policy "Allow sending friend requests"
  on public.friends for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Allow accepting friend requests"
  on public.friends for update
  to authenticated
  using (auth.uid() = friend_id)
  with check (status = 'accepted');

create policy "Allow unfriending or declining requests"
  on public.friends for delete
  to authenticated
  using (auth.uid() = user_id or auth.uid() = friend_id);
