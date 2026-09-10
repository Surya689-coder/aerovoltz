export type UnitId = 'MEDDROP' | 'ROVER_R1' | 'RECON';

export type UnitType = 'drone' | 'rover';

export type MissionStatus = 'planning' | 'active' | 'paused' | 'completed' | 'aborted';

export type SurvivorStatus = 'reported' | 'verified' | 'aided' | 'rescued';

export type SurvivorSeverity = 'low' | 'medium' | 'high' | 'critical';

export type AlertType =
  | 'survivor_found'
  | 'low_battery'
  | 'link_lost'
  | 'payload_delivered'
  | 'geofence_breach'
  | 'mission_started'
  | 'mission_completed'
  | 'waypoint_reached'
  | 'system';

export type AlertSeverity = 'info' | 'warning' | 'critical' | 'success';

export type EventType = 'telemetry' | 'mission' | 'survivor' | 'alert' | 'system';

export type UserRole = 'commander' | 'observer';

export interface Waypoint {
  x: number;
  y: number;
  label: string;
}

export interface GeofencePoint {
  x: number;
  y: number;
}

export interface UnitTelemetry {
  unitId: UnitId;
  unitType: UnitType;
  callsign: string;
  name: string;
  x: number;
  y: number;
  altitude: number;
  speed: number;
  heading: number;
  battery: number;
  signalStrength: number;
  gpsLat: string;
  gpsLng: string;
  mode: string;
  armed: boolean;
  status: UnitStatus;
  trail: TrailPoint[];
  currentWaypoint: number;
  thumbnail: string;
}

export type UnitStatus = 'Idle' | 'En route' | 'Scanning' | 'Delivering' | 'Returning' | 'Offline';

export interface TrailPoint {
  x: number;
  y: number;
  ts: number;
}

export interface Mission {
  id: string;
  name: string;
  description: string | null;
  unit_id: UnitId;
  payload: string | null;
  waypoints: Waypoint[];
  geofence: GeofencePoint[];
  status: MissionStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface Survivor {
  id: string;
  mission_id: string | null;
  survivor_id: string;
  lat: number;
  lng: number;
  detected_by: UnitId;
  confidence: number;
  severity: SurvivorSeverity;
  medicine_dispatched: boolean;
  status: SurvivorStatus;
  detected_at: string;
  created_by: string;
  created_at: string;
}

export interface Alert {
  id: string;
  mission_id: string | null;
  unit_id: UnitId | null;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  acknowledged: boolean;
  created_at: string;
}

export interface MissionEvent {
  id: string;
  mission_id: string | null;
  unit_id: UnitId | null;
  type: EventType;
  message: string;
  data: Record<string, unknown> | null;
  created_at: string;
}

export interface TelemetrySnapshot {
  id: string;
  unit_id: UnitId;
  mission_id: string | null;
  lat: number;
  lng: number;
  altitude: number;
  speed: number;
  battery: number;
  signal_strength: number;
  heading: number;
  mode: string;
  armed: boolean;
  created_at: string;
}

export interface OccupancyCell {
  x: number;
  y: number;
  state: 'unknown' | 'free' | 'obstacle' | 'explored';
}

export interface OccupancyMap {
  grid: Uint8Array;
  width: number;
  height: number;
  cellSize: number;
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
}
