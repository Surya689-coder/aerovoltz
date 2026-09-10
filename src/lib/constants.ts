import type {
  UnitId,
  UnitType,
  UnitStatus,
  UnitTelemetry,
  Waypoint,
  AlertType,
  AlertSeverity,
  SurvivorSeverity,
  SurvivorStatus,
} from '@/types';

export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 700;

export const UNIT_CONFIG: Record<
  UnitId,
  { callsign: string; name: string; type: UnitType; color: string; startX: number; startY: number }
> = {
  MEDDROP: {
    callsign: 'AV-01',
    name: 'MEDDROP',
    type: 'drone',
    color: '#f59e0b',
    startX: 200,
    startY: 550,
  },
  ROVER_R1: {
    callsign: 'AV-02',
    name: 'ROVER R1',
    type: 'rover',
    color: '#14b8a6',
    startX: 150,
    startY: 580,
  },
  RECON: {
    callsign: 'AV-03',
    name: 'RECON',
    type: 'drone',
    color: '#38bdf8',
    startX: 250,
    startY: 530,
  },
};

export const UNIT_IDS: UnitId[] = ['MEDDROP', 'ROVER_R1', 'RECON'];

export const STATUS_COLORS: Record<UnitStatus, string> = {
  Idle: '#64748b',
  'En route': '#38bdf8',
  Scanning: '#14b8a6',
  Delivering: '#f59e0b',
  Returning: '#a78bfa',
  Offline: '#ef4444',
};

export const ALERT_SEVERITY_CONFIG: Record<
  AlertSeverity,
  { color: string; bg: string; border: string; label: string }
> = {
  info: { color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.1)', border: 'rgba(56, 189, 248, 0.3)', label: 'INFO' },
  warning: {
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.1)',
    border: 'rgba(245, 158, 11, 0.3)',
    label: 'WARN',
  },
  critical: {
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.1)',
    border: 'rgba(239, 68, 68, 0.3)',
    label: 'CRIT',
  },
  success: {
    color: '#22c55e',
    bg: 'rgba(34, 197, 94, 0.1)',
    border: 'rgba(34, 197, 94, 0.3)',
    label: 'OK',
  },
};

export const SURVIVOR_SEVERITY_CONFIG: Record<
  SurvivorSeverity,
  { color: string; bg: string; label: string }
> = {
  low: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)', label: 'LOW' },
  medium: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', label: 'MED' },
  high: { color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)', label: 'HIGH' },
  critical: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', label: 'CRIT' },
};

export const SURVIVOR_STATUS_CONFIG: Record<SurvivorStatus, { color: string; label: string }> = {
  reported: { color: '#94a3b8', label: 'Reported' },
  verified: { color: '#38bdf8', label: 'Verified' },
  aided: { color: '#f59e0b', label: 'Aided' },
  rescued: { color: '#22c55e', label: 'Rescued' },
};

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  survivor_found: 'Survivor Found',
  low_battery: 'Low Battery',
  link_lost: 'Link Lost',
  payload_delivered: 'Payload Delivered',
  geofence_breach: 'Geofence Breach',
  mission_started: 'Mission Started',
  mission_completed: 'Mission Completed',
  waypoint_reached: 'Waypoint Reached',
  system: 'System',
};

export function gpsFormat(x: number, y: number): { lat: string; lng: string } {
  const lat = (28.6139 + (MAP_HEIGHT / 2 - y) * 0.00009).toFixed(5);
  const lng = (77.2090 + (x - MAP_WIDTH / 2) * 0.00011).toFixed(5);
  return { lat, lng };
}

export function formatTime(ts: number | string): string {
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function angleBetween(x1: number, y1: number, x2: number, y2: number): number {
  return (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
}

export function normalizeAngle(a: number): number {
  return ((a % 360) + 360) % 360;
}

export function generateWaypointLabel(index: number): string {
  return `WP-${String(index + 1).padStart(2, '0')}`;
}

export function defaultGeofence(): Waypoint[] {
  return [
    { x: 100, y: 100, label: 'GF-1' },
    { x: 900, y: 100, label: 'GF-2' },
    { x: 900, y: 600, label: 'GF-3' },
    { x: 100, y: 600, label: 'GF-4' },
  ];
}

export function batteryColor(battery: number): string {
  if (battery > 50) return '#14b8a6';
  if (battery > 25) return '#f59e0b';
  if (battery > 10) return '#f97316';
  return '#ef4444';
}

export function signalColor(signal: number): string {
  if (signal > -60) return '#14b8a6';
  if (signal > -75) return '#38bdf8';
  if (signal > -85) return '#f59e0b';
  return '#ef4444';
}

export function confidenceColor(conf: number): string {
  if (conf >= 0.8) return '#22c55e';
  if (conf >= 0.6) return '#38bdf8';
  if (conf >= 0.4) return '#f59e0b';
  return '#ef4444';
}
