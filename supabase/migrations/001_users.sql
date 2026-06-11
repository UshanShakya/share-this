-- Create public.profiles table
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  display_name text,
  avatar_url text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set constraints on username format
alter table public.profiles 
  add constraint username_length check (char_length(username) >= 3);

-- Enable Row Level Security
alter table public.profiles enable row level security;

-- Policies for profiles
create policy "Allow public read access to profiles" 
  on public.profiles for select 
  using (true);

create policy "Allow individual user profile insertion" 
  on public.profiles for insert 
  with check (auth.uid() = id);

create policy "Allow individual users to update their own profile" 
  on public.profiles for update 
  using (auth.uid() = id);

-- Trigger to automatically create a profile when a new user signs up in auth.users
create or replace function public.handle_new_user()
returns trigger as $$
declare
  default_username text;
  default_display_name text;
begin
  default_username := coalesce(
    new.raw_user_meta_data->>'username', 
    'user_' || lower(substring(new.id::text from 1 for 8))
  );
  default_display_name := coalesce(
    new.raw_user_meta_data->>'display_name', 
    'User_' || substring(new.id::text from 1 for 8)
  );

  insert into public.profiles (id, username, display_name, avatar_url, updated_at)
  values (
    new.id,
    default_username,
    default_display_name,
    null,
    now()
  );
  return new;
exception
  when others then
    -- Suppress and allow user creation to continue; client can create profile manually if needed
    return new;
end;
$$ language plpgsql security definer;

-- Recreate trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
