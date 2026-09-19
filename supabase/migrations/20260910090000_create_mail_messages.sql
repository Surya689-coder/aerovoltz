-- Mailbox storage for messages received from an email provider or entered by operators.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.mail_messages (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	message_id text UNIQUE,
	thread_id text,
	sender_name text,
	sender_email text NOT NULL,
	recipient_email text NOT NULL,
	cc text[] NOT NULL DEFAULT '{}',
	bcc text[] NOT NULL DEFAULT '{}',
	subject text NOT NULL DEFAULT '(no subject)',
	body_text text NOT NULL DEFAULT '',
	body_html text,
	status text NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived')),
	priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
	received_at timestamptz NOT NULL DEFAULT now(),
	read_at timestamptz,
	read_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
	raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mail_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_mail_messages" ON public.mail_messages;
CREATE POLICY "select_mail_messages" ON public.mail_messages
	FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_mail_messages" ON public.mail_messages;
CREATE POLICY "insert_mail_messages" ON public.mail_messages
	FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_mail_messages" ON public.mail_messages;
CREATE POLICY "update_mail_messages" ON public.mail_messages
	FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_mail_messages_received_at
	ON public.mail_messages(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_mail_messages_status
	ON public.mail_messages(status);
CREATE INDEX IF NOT EXISTS idx_mail_messages_thread_id
	ON public.mail_messages(thread_id);

DROP TRIGGER IF EXISTS mail_messages_updated_at ON public.mail_messages;
CREATE TRIGGER mail_messages_updated_at
	BEFORE UPDATE ON public.mail_messages
	FOR EACH ROW
	EXECUTE FUNCTION update_updated_at();
