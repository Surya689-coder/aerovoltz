-- Demo-only access rules for the table-backed app session.
-- Replace these policies with authenticated ownership rules before production use.

ALTER TABLE public.missions ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.missions ALTER COLUMN created_by DROP DEFAULT;
ALTER TABLE public.survivors ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.survivors ALTER COLUMN created_by DROP DEFAULT;
ALTER TABLE public.missions DROP CONSTRAINT IF EXISTS missions_created_by_fkey;
ALTER TABLE public.survivors DROP CONSTRAINT IF EXISTS survivors_created_by_fkey;

DROP POLICY IF EXISTS "select_missions" ON public.missions;
DROP POLICY IF EXISTS "insert_missions" ON public.missions;
DROP POLICY IF EXISTS "update_missions" ON public.missions;
DROP POLICY IF EXISTS "delete_missions" ON public.missions;
CREATE POLICY "demo_select_missions" ON public.missions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "demo_insert_missions" ON public.missions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "demo_update_missions" ON public.missions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo_delete_missions" ON public.missions FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "select_survivors" ON public.survivors;
DROP POLICY IF EXISTS "insert_survivors" ON public.survivors;
DROP POLICY IF EXISTS "update_survivors" ON public.survivors;
DROP POLICY IF EXISTS "delete_survivors" ON public.survivors;
CREATE POLICY "demo_select_survivors" ON public.survivors FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "demo_insert_survivors" ON public.survivors FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "demo_update_survivors" ON public.survivors FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo_delete_survivors" ON public.survivors FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "select_alerts" ON public.alerts;
DROP POLICY IF EXISTS "insert_alerts" ON public.alerts;
DROP POLICY IF EXISTS "update_alerts" ON public.alerts;
DROP POLICY IF EXISTS "delete_alerts" ON public.alerts;
CREATE POLICY "demo_select_alerts" ON public.alerts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "demo_insert_alerts" ON public.alerts FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "demo_update_alerts" ON public.alerts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo_delete_alerts" ON public.alerts FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "select_events" ON public.events;
DROP POLICY IF EXISTS "insert_events" ON public.events;
DROP POLICY IF EXISTS "delete_events" ON public.events;
CREATE POLICY "demo_select_events" ON public.events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "demo_insert_events" ON public.events FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "demo_delete_events" ON public.events FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "select_telemetry" ON public.telemetry_history;
DROP POLICY IF EXISTS "insert_telemetry" ON public.telemetry_history;
CREATE POLICY "demo_select_telemetry" ON public.telemetry_history FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "demo_insert_telemetry" ON public.telemetry_history FOR INSERT TO anon, authenticated WITH CHECK (true);
