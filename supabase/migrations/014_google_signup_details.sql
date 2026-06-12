-- Update public.handle_new_user trigger function to map Google OAuth details
create or replace function public.handle_new_user()
returns trigger as $$
declare
  default_username text;
  default_display_name text;
  default_avatar_url text;
begin
  -- Keep username random (prefixed with user_) for Google signups
  default_username := coalesce(
    new.raw_user_meta_data->>'username', 
    'user_' || lower(substring(new.id::text from 1 for 8))
  );
  
  -- Set display name to Google/Gmail full name or name if present, else fallback
  default_display_name := coalesce(
    new.raw_user_meta_data->>'display_name', 
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    'User_' || substring(new.id::text from 1 for 8)
  );
  
  -- Fetch Google avatar if present, else assign default Bottts avatar
  default_avatar_url := coalesce(
    new.raw_user_meta_data->>'avatar_url',
    'https://api.dicebear.com/7.x/bottts/png?seed=' || substring(new.id::text from 1 for 8)
  );

  insert into public.profiles (id, username, display_name, avatar_url, updated_at)
  values (
    new.id,
    default_username,
    default_display_name,
    default_avatar_url,
    now()
  )
  on conflict (id) do update
  set
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    updated_at = now();
    
  return new;
exception
  when others then
    return new;
end;
$$ language plpgsql security definer;
