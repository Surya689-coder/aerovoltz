/*
# Search & Rescue Mission Control Dashboard Schema

## Overview
Creates the complete database schema for the Aero Voltz SAR (Search and Rescue) mission control dashboard.
This dashboard coordinates three autonomous units (MEDDROP drone, ROVER R1, RECON drone) during disaster
response missions, tracking live telemetry, survivor detections, mission events, and alerts.

## New Tables

### `missions`
Stores mission definitions with waypoints, assigned units, payload info, and lifecycle state.
- `id` (uuid, primary key)
- `name` (text, mission name)
- `description` (text, optional description)
- `unit_id` (text, which unit is assigned: MEDDROP, ROVER_R1, RECON)
- `payload` (text, payload contents for MEDDROP missions)
- `waypoints` (jsonb, array of {x, y, label} coordinates on the tactical map)
- `geofence` (jsonb, polygon coordinates defining the mission boundary)
- `status` (text, one of: planning, active, paused, completed, aborted)
- `created_by` (uuid, references auth.users)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)
- `started_at` (timestamptz, when mission went active)
- `completed_at` (timestamptz, when mission finished)

### `survivors`
Registry of detected survivors from sensor data.
- `id` (uuid, primary key)
- `mission_id` (uuid, references missions, nullable)
- `survivor_id` (text, human-readable ID like S-001)
- `lat` (float, x coordinate on map)
- `lng` (float, y coordinate on map)
- `detected_by` (text, which unit detected: MEDDROP, ROVER_R1, RECON)
- `confidence` (float, 0-1 detection confidence score)
- `severity` (text, one of: low, medium, high, critical)
- `medicine_dispatched` (boolean, whether medicine was delivered)
- `status` (text, one of: reported, verified, aided, rescued)
- `detected_at` (timestamptz)
- `created_by` (uuid, references auth.users)

### `alerts`
Time-series alert feed for the live operations view.
- `id` (uuid, primary key)
- `mission_id` (uuid, references missions, nullable)
- `unit_id` (text, which unit triggered the alert)
- `type` (text, one of: survivor_found, low_battery, link_lost, payload_delivered, geofence_breach, mission_started, mission_completed, waypoint_reached)
- `severity` (text, one of: info, warning, critical, success)
- `message` (text, alert message)
- `acknowledged` (boolean, default false)
- `created_at` (timestamptz)

### `events`
Mission log timeline — every significant event for after-action reports.
- `id` (uuid, primary key)
- `mission_id` (uuid, references missions, nullable)
- `unit_id` (text, which unit was involved)
- `type` (text, event type: telemetry, mission, survivor, alert, system)
- `message` (text, event description)
- `data` (jsonb, optional structured event data)
- `created_at` (timestamptz)

### `telemetry_history`
Historical telemetry snapshots for after-action analysis.
- `id` (uuid, primary key)
- `unit_id` (text, which unit)
- `mission_id` (uuid, references missions, nullable)
- `lat` (float, x position)
- `lng` (float, y position)
- `altitude` (float, meters)
- `speed` (float, m/s)
- `battery` (float, percentage 0-100)
- `signal_strength` (float, dBm)
- `heading` (float, degrees 0-360)
- `mode` (text, flight/operation mode)
- `armed` (boolean)
- `created_at` (timestamptz)

## Security
- RLS enabled on all tables.
- All tables allow authenticated users to read (shared operational picture).
- Owner-scoped tables (missions, survivors) restrict writes to the creator.
- Shared tables (alerts, events, telemetry) allow any authenticated user to insert.
*/

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================
-- MISSIONS
-- =============================================================
CREATE TABLE IF NOT EXISTS missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  unit_id text NOT NULL DEFAULT 'RECON',
  payload text,
  waypoints jsonb NOT NULL DEFAULT '[]'::jsonb,
  geofence jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'planning',
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

ALTER TABLE missions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_missions" ON missions;
CREATE POLICY "select_missions" ON missions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_missions" ON missions;
CREATE POLICY "insert_missions" ON missions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "update_missions" ON missions;
CREATE POLICY "update_missions" ON missions FOR UPDATE
  TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "delete_missions" ON missions;
CREATE POLICY "delete_missions" ON missions FOR DELETE
  TO authenticated USING (auth.uid() = created_by);

-- =============================================================
-- SURVIVORS
-- =============================================================
CREATE TABLE IF NOT EXISTS survivors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid REFERENCES missions(id) ON DELETE SET NULL,
  survivor_id text NOT NULL,
  lat float NOT NULL,
  lng float NOT NULL,
  detected_by text NOT NULL DEFAULT 'RECON',
  confidence float NOT NULL DEFAULT 0.5,
  severity text NOT NULL DEFAULT 'medium',
  medicine_dispatched boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'reported',
  detected_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE survivors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_survivors" ON survivors;
CREATE POLICY "select_survivors" ON survivors FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_survivors" ON survivors;
CREATE POLICY "insert_survivors" ON survivors FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "update_survivors" ON survivors;
CREATE POLICY "update_survivors" ON survivors FOR UPDATE
  TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "delete_survivors" ON survivors;
CREATE POLICY "delete_survivors" ON survivors FOR DELETE
  TO authenticated USING (auth.uid() = created_by);

-- =============================================================
-- ALERTS
-- =============================================================
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid REFERENCES missions(id) ON DELETE SET NULL,
  unit_id text,
  type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_alerts" ON alerts;
CREATE POLICY "select_alerts" ON alerts FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_alerts" ON alerts;
CREATE POLICY "insert_alerts" ON alerts FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_alerts" ON alerts;
CREATE POLICY "update_alerts" ON alerts FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_alerts" ON alerts;
CREATE POLICY "delete_alerts" ON alerts FOR DELETE
  TO authenticated USING (true);

-- =============================================================
-- EVENTS
-- =============================================================
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid REFERENCES missions(id) ON DELETE SET NULL,
  unit_id text,
  type text NOT NULL DEFAULT 'system',
  message text NOT NULL,
  data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_events" ON events;
CREATE POLICY "select_events" ON events FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_events" ON events;
CREATE POLICY "insert_events" ON events FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "delete_events" ON events;
CREATE POLICY "delete_events" ON events FOR DELETE
  TO authenticated USING (true);

-- =============================================================
-- TELEMETRY HISTORY
-- =============================================================
CREATE TABLE IF NOT EXISTS telemetry_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id text NOT NULL,
  mission_id uuid REFERENCES missions(id) ON DELETE SET NULL,
  lat float NOT NULL,
  lng float NOT NULL,
  altitude float NOT NULL DEFAULT 0,
  speed float NOT NULL DEFAULT 0,
  battery float NOT NULL DEFAULT 100,
  signal_strength float NOT NULL DEFAULT -60,
  heading float NOT NULL DEFAULT 0,
  mode text NOT NULL DEFAULT 'idle',
  armed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE telemetry_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_telemetry" ON telemetry_history;
CREATE POLICY "select_telemetry" ON telemetry_history FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_telemetry" ON telemetry_history;
CREATE POLICY "insert_telemetry" ON telemetry_history FOR INSERT
  TO authenticated WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
CREATE INDEX IF NOT EXISTS idx_missions_created_by ON missions(created_by);
CREATE INDEX IF NOT EXISTS idx_survivors_mission ON survivors(mission_id);
CREATE INDEX IF NOT EXISTS idx_survivors_status ON survivors(status);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_mission ON alerts(mission_id);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_mission ON events(mission_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_unit ON telemetry_history(unit_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_created ON telemetry_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_mission ON telemetry_history(mission_id);

-- Auto-update updated_at on missions
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS missions_updated_at ON missions;
CREATE TRIGGER missions_updated_at
  BEFORE UPDATE ON missions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
