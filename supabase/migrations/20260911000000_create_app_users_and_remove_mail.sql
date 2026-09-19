-- Remove the old mailbox feature. App-user setup is provided as a standalone
-- script in supabase/app_users_setup.sql for manual execution.
DROP TABLE IF EXISTS public.mail_messages;
