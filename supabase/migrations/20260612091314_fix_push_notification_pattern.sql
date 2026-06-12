-- Update trigger function to automatically send remote push notifications via Expo Push API
-- supporting both legacy (ExponentPushToken) and modern (ExpoPushToken) push tokens.
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
  if target_token is not null and (target_token like 'ExponentPushToken[%]' or target_token like 'ExpoPushToken[%]') then
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
