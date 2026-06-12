-- Enable Realtime for notifications table by adding it to the supabase_realtime publication
alter publication supabase_realtime add table public.notifications;
