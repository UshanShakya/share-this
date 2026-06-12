-- Add expo_push_token column to profiles table
alter table public.profiles add column if not exists expo_push_token text;

-- Enable pg_net extension for sending async HTTP requests from database triggers
create extension if not exists pg_net with schema extensions;

-- Trigger function to automatically send remote push notifications via Expo Push API
create or replace function public.handle_send_push_notification()
returns trigger as $$
declare
  target_token text;
begin
  -- Retrieve the recipient's expo_push_token
  select expo_push_token into target_token 
  from public.profiles 
  where id = new.user_id;

  -- Only send push notification if the user has registered a valid Expo push token
  if target_token is not null and target_token like 'ExponentPushToken[%]' then
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
      body := jsonb_build_array(
        jsonb_build_object(
          'to', target_token,
          'title', new.title,
          'body', new.message,
          'sound', 'default',
          'data', jsonb_build_object(
            'type', new.type,
            'relatedId', new.related_id
          )
        )
      ),
      timeout_ms := 5000
    );
  end if;
  return new;
exception
  when others then
    -- Catch all to prevent blocking notification table inserts on network/API failure
    return new;
end;
$$ language plpgsql security definer;

-- Create trigger on notifications table
drop trigger if exists on_notification_inserted on public.notifications;
create trigger on_notification_inserted
  after insert on public.notifications
  for each row execute function public.handle_send_push_notification();
