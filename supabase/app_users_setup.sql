-- Paste this script into Supabase SQL Editor once.
-- This is demo-only login storage, not production authentication.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (position('@' in email) > 1),
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'observer' CHECK (role IN ('commander', 'observer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "demo_login_read_users" ON public.app_users;
CREATE POLICY "demo_login_read_users" ON public.app_users
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "demo_signup_insert_users" ON public.app_users;
CREATE POLICY "demo_signup_insert_users" ON public.app_users
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "demo_update_users" ON public.app_users;
CREATE POLICY "demo_update_users" ON public.app_users
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_app_users_email ON public.app_users(email);

CREATE OR REPLACE FUNCTION public.update_app_user_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS app_users_updated_at ON public.app_users;
CREATE TRIGGER app_users_updated_at
  BEFORE UPDATE ON public.app_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_app_user_updated_at();

CREATE TABLE IF NOT EXISTS public.login_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('commander', 'observer')),
  login_time timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "demo_insert_login_history" ON public.login_history;
CREATE POLICY "demo_insert_login_history" ON public.login_history
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_login_history" ON public.login_history;
CREATE POLICY "authenticated_read_login_history" ON public.login_history
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON public.login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_email ON public.login_history(email);
CREATE INDEX IF NOT EXISTS idx_login_history_time ON public.login_history(login_time DESC);

CREATE OR REPLACE FUNCTION public.verify_app_login(
  login_email text,
  login_password text
)
RETURNS TABLE (user_id uuid, user_email text, user_role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
  DECLARE matched_user public.app_users%ROWTYPE;
  BEGIN
    SELECT * INTO matched_user
    FROM public.app_users
    WHERE lower(email) = lower(login_email)
      AND password_hash = crypt(login_password, password_hash)
    LIMIT 1;

    IF matched_user.id IS NULL THEN
      RETURN;
    END IF;

    INSERT INTO public.login_history (user_id, email, role)
    VALUES (matched_user.id, matched_user.email, matched_user.role);

    user_id := matched_user.id;
    user_email := matched_user.email;
    user_role := matched_user.role;
    RETURN NEXT;
  END;
$$;

CREATE OR REPLACE FUNCTION public.create_app_user(
  new_email text,
  new_password text,
  new_role text
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.app_users (email, password_hash, role)
  VALUES (lower(trim(new_email)), crypt(new_password, gen_salt('bf')), new_role)
  RETURNING id;
$$;

GRANT EXECUTE ON FUNCTION public.verify_app_login(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_app_user(text, text, text) TO anon, authenticated;

-- Refresh the Supabase REST schema cache immediately.
NOTIFY pgrst, 'reload schema';