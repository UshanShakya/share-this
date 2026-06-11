-- Redefine public.handle_new_user trigger function to assign a default avatar URL on signup
create or replace function public.handle_new_user()
returns trigger as $$
declare
  default_username text;
  default_display_name text;
  default_avatar_url text;
begin
  default_username := coalesce(
    new.raw_user_meta_data->>'username', 
    'user_' || lower(substring(new.id::text from 1 for 8))
  );
  default_display_name := coalesce(
    new.raw_user_meta_data->>'display_name', 
    'User_' || substring(new.id::text from 1 for 8)
  );
  -- Assign default Bottts avatar seed based on user's unique UUID
  default_avatar_url := 'https://api.dicebear.com/7.x/bottts/png?seed=' || substring(new.id::text from 1 for 8);

  insert into public.profiles (id, username, display_name, avatar_url, updated_at)
  values (
    new.id,
    default_username,
    default_display_name,
    default_avatar_url,
    now()
  );
  return new;
exception
  when others then
    return new;
end;
$$ language plpgsql security definer;

-- Create public.notifications table
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  message text not null,
  type text not null, -- 'friend_request', 'room_invite', 'canvas_update', 'room_update'
  related_id uuid,
  is_read boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.notifications enable row level security;

-- Policies for notifications
drop policy if exists "Users can view their own notifications" on public.notifications;
create policy "Users can view their own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update their own notifications" on public.notifications;
create policy "Users can update their own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

drop policy if exists "Anyone can insert notifications" on public.notifications;
create policy "Anyone can insert notifications"
  on public.notifications for insert
  with check (true);
