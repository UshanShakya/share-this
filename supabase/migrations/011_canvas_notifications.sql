-- Trigger function for strokes insertion (Canvas Updated)
create or replace function public.handle_stroke_inserted()
returns trigger as $$
declare
  member record;
  room_name text;
  sender_name text;
begin
  -- Get room name
  select name into room_name from public.rooms where id = new.room_id;
  
  -- Get sender name
  select coalesce(display_name, username, 'Someone') into sender_name from public.profiles where id = new.user_id;

  -- Loop through other accepted room members
  for member in 
    select user_id from public.room_members 
    where room_id = new.room_id 
      and user_id != new.user_id 
      and status = 'accepted'
  loop
    -- Debounce notifications to once every 5 minutes per user per room to prevent drawing spam
    if not exists (
      select 1 from public.notifications 
      where user_id = member.user_id 
        and type = 'canvas_update' 
        and related_id = new.room_id 
        and created_at > (now() - interval '5 minutes')
    ) then
      insert into public.notifications (user_id, title, message, type, related_id)
      values (
        member.user_id,
        'Canvas Updated',
        sender_name || ' updated the canvas in "' || room_name || '".',
        'canvas_update',
        new.room_id
      );
    end if;
  end loop;
  
  return new;
end;
$$ language plpgsql security definer;

-- Create trigger on strokes table
drop trigger if exists on_stroke_inserted on public.strokes;
create trigger on_stroke_inserted
  after insert on public.strokes
  for each row execute function public.handle_stroke_inserted();


-- Trigger function for room updates (Room Renamed)
create or replace function public.handle_room_updated()
returns trigger as $$
declare
  member record;
  updater_name text;
begin
  -- Only trigger if the name actually changed
  if old.name is distinct from new.name then
    -- Get current updater profile
    select coalesce(display_name, username, 'Someone') into updater_name from public.profiles where id = auth.uid();
    
    for member in 
      select user_id from public.room_members 
      where room_id = new.id 
        and user_id != auth.uid()
        and status = 'accepted'
    loop
      insert into public.notifications (user_id, title, message, type, related_id)
      values (
        member.user_id,
        'Room Name Updated',
        updater_name || ' renamed the room to "' || new.name || '".',
        'room_update',
        new.id
      );
    end loop;
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

-- Create trigger on rooms table
drop trigger if exists on_room_updated on public.rooms;
create trigger on_room_updated
  after update on public.rooms
  for each row execute function public.handle_room_updated();
