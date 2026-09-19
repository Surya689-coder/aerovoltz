import type { GeofencePoint, Survivor, UnitId, Waypoint } from '@/types';
import { latLngToMap } from '@/lib/constants';

export type MissionMode = 'autonomous' | 'manual';
export type MissionType = 'verification' | 'supply' | 'search';

export interface MissionSummary {
  id: string;
  type: MissionType;
  mode: MissionMode;
  name: string;
  assignedUnit: UnitId;
  targetLatitude: number;
  targetLongitude: number;
  targetAltitude: number;
  payload: string;
  status: string;
  distanceKm: number;
  etaMinutes: number;
  peakAltitude: number;
  waypoints: Waypoint[];
  routeValid: boolean;
  geofenceValid: boolean;
  batterySufficient: boolean;
  reason?: string;
}

export const SUPPLY_PAYLOADS = [
  'Medical Kit',
  'First Aid',
  'Water',
  'Food',
  'Emergency Aid',
  'Custom',
] as const;

export function selectAvailableSupplyUAV(): UnitId {
  return 'MEDDROP';
}

export function createVerificationMission(detection: {
  id: string;
  lat: number;
  lng: number;
  detectedBy: UnitId;
  source?: string;
}): MissionSummary {
  const targetAltitude = 18;
  const { x, y } = latLngToMap(detection.lat, detection.lng);
  const waypoints: Waypoint[] = [
    { x, y, label: 'VERIFY-01', latitude: detection.lat, longitude: detection.lng, altitude: targetAltitude },
    { x: x + 35, y: y + 20, label: 'VERIFY-02', latitude: detection.lat + 0.00025, longitude: detection.lng + 0.00018, altitude: targetAltitude + 8 },
  ];

  return {
    id: `VER-${detection.id}`,
    type: 'verification',
    mode: 'autonomous',
    name: `Verification ${detection.id}`,
    assignedUnit: 'ROVER_R1',
    targetLatitude: detection.lat,
    targetLongitude: detection.lng,
    targetAltitude,
    payload: 'Verification payload',
    status: 'VERIFYING',
    distanceKm: 1.2,
    etaMinutes: 4,
    peakAltitude: targetAltitude + 8,
    waypoints,
    routeValid: true,
    geofenceValid: true,
    batterySufficient: true,
  };
}

export function canAutonomousSupplyDispatch(survivor: Pick<Survivor, 'verificationStatus' | 'status'>): boolean {
  return survivor.verificationStatus === 'VERIFIED' || survivor.status === 'verified';
}

export function createSupplyMissionFromVerifiedSurvivor(survivor: Survivor): MissionSummary | null {
  if (!canAutonomousSupplyDispatch(survivor)) {
    return null;
  }

  const targetAltitude = 50;
  const { x, y } = latLngToMap(survivor.lat, survivor.lng);
  const waypoints: Waypoint[] = [
    { x: x, y: y, label: 'SUPPLY-01', latitude: survivor.lat, longitude: survivor.lng, altitude: targetAltitude },
    { x: x + 55, y: y - 35, label: 'SUPPLY-02', latitude: survivor.lat + 0.00018, longitude: survivor.lng + 0.00022, altitude: targetAltitude },
  ];

  return {
    id: `SUP-${survivor.survivor_id}`,
    type: 'supply',
    mode: 'autonomous',
    name: `${survivor.survivor_id} Supply Mission`,
    assignedUnit: selectAvailableSupplyUAV(),
    targetLatitude: survivor.lat,
    targetLongitude: survivor.lng,
    targetAltitude,
    payload: 'Emergency Medical Kit',
    status: 'READY',
    distanceKm: 1.8,
    etaMinutes: 4,
    peakAltitude: targetAltitude,
    waypoints,
    routeValid: true,
    geofenceValid: true,
    batterySufficient: true,
  };
}

export function createManualSupplyMission(input: {
  name: string;
  latitude: number;
  longitude: number;
  altitude: number;
  payload: string;
  assignedUnit?: UnitId;
}): MissionSummary {
  const assignedUnit = input.assignedUnit ?? selectAvailableSupplyUAV();
  const { x, y } = latLngToMap(input.latitude, input.longitude);
  const waypoints: Waypoint[] = [
    { x, y, label: 'LZ-01', latitude: input.latitude, longitude: input.longitude, altitude: input.altitude },
    { x: x + 90, y: y + 55, label: 'LZ-02', latitude: input.latitude + 0.00032, longitude: input.longitude + 0.00022, altitude: input.altitude + 10 },
  ];

  return {
    id: `MAN-${Date.now().toString().slice(-6)}`,
    type: 'supply',
    mode: 'manual',
    name: input.name || 'Manual Supply Mission',
    assignedUnit,
    targetLatitude: input.latitude,
    targetLongitude: input.longitude,
    targetAltitude: input.altitude,
    payload: input.payload || 'Emergency Aid',
    status: 'DRAFT',
    distanceKm: 2.4,
    etaMinutes: 5,
    peakAltitude: input.altitude + 10,
    waypoints,
    routeValid: true,
    geofenceValid: true,
    batterySufficient: true,
  };
}

export function validateMission(mission: Pick<MissionSummary, 'targetLatitude' | 'targetLongitude' | 'targetAltitude' | 'routeValid' | 'geofenceValid' | 'batterySufficient' | 'assignedUnit'>): {
  valid: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  if (!Number.isFinite(mission.targetLatitude) || mission.targetLatitude < -90 || mission.targetLatitude > 90) {
    reasons.push('Latitude out of range');
  }
  if (!Number.isFinite(mission.targetLongitude) || mission.targetLongitude < -180 || mission.targetLongitude > 180) {
    reasons.push('Longitude out of range');
  }
  if (!Number.isFinite(mission.targetAltitude) || mission.targetAltitude <= 0 || mission.targetAltitude > 3000) {
    reasons.push('Altitude outside valid operating envelope');
  }
  if (!mission.routeValid) {
    reasons.push('Route invalid');
  }
  if (!mission.geofenceValid) {
    reasons.push('Target outside geofence');
  }
  if (!mission.batterySufficient) {
    reasons.push('Supply UAV battery below mission threshold');
  }

  return {
    valid: reasons.length === 0,
    reasons,
  };
}

export function calculateRouteDistanceKm(x1: number, y1: number, x2: number, y2: number): number {
  const distancePx = Math.hypot(x2 - x1, y2 - y1);
  return Number((distancePx / 600).toFixed(2));
}

export function calculateETA(distanceKm: number, speedKph = 18): number {
  return Math.max(1, Math.round((distanceKm / speedKph) * 60));
}

export function buildMissionWaypointSet(target: { lat: number; lng: number; altitude: number }, geofence: GeofencePoint[]) {
  void geofence;
  const center = latLngToMap(target.lat, target.lng);
  return [
    { x: center.x, y: center.y, label: 'WAYPOINT-01', latitude: target.lat, longitude: target.lng, altitude: target.altitude },
    { x: Math.min(960, center.x + 80), y: Math.max(80, center.y - 60), label: 'WAYPOINT-02', latitude: target.lat + 0.00018, longitude: target.lng + 0.00026, altitude: target.altitude + 10 },
    { x: Math.min(960, center.x + 160), y: Math.max(80, center.y + 40), label: 'WAYPOINT-03', latitude: target.lat + 0.00036, longitude: target.lng + 0.00052, altitude: target.altitude + 15 },
  ] as Waypoint[];
}
