import type {
  UnitId,
  UnitTelemetry,
  Waypoint,
  Alert,
  Survivor,
  SurvivorSeverity,
  SurvivorStatus,
  Mission,
  OccupancyMap,
  RoverVerificationMission,
  SupplyMission,
} from '@/types';
import {
  UNIT_CONFIG,
  UNIT_IDS,
  MAP_WIDTH,
  MAP_HEIGHT,
  gpsFormat,
  distance,
  lerp,
  normalizeAngle,
  angleBetween,
  latLngToMap,
} from './constants';

type AlertCallback = (alert: Omit<Alert, 'id' | 'acknowledged' | 'created_at'>) => void;
type SurvivorCallback = (survivor: Omit<Survivor, 'id' | 'created_by' | 'created_at'>) => void;
type EventCallback = (event: { unit_id: UnitId | null; type: string; message: string; data?: Record<string, unknown> }) => void;
type VerificationResultCallback = (result: {
  detectionId: string;
  verificationStatus: 'VERIFIED' | 'REJECTED';
  verifiedBy: UnitId;
  verifiedAt: string;
  latitude: number;
  longitude: number;
  altitude: number;
}) => void;

interface SimUnit {
  telemetry: UnitTelemetry;
  targetX: number;
  targetY: number;
  waypointIndex: number;
  waypoints: Waypoint[];
  missionActive: boolean;
  scanning: boolean;
  scanAngle: number;
  scanRadius: number;
  baseX: number;
  baseY: number;
  returning: boolean;
  delivering: boolean;
  deliverProgress: number;
  batteryDrain: number;
  lastLowBatteryAlert: number;
  lastLinkAlert: number;
  slamGrid: Uint8Array;
  slamInitialized: boolean;
}

const SLAM_W = 50;
const SLAM_H = 35;
const SLAM_CELL = 20;

// Pre-defined obstacles for the SLAM map
const OBSTACLES: { x: number; y: number; w: number; h: number }[] = [
  { x: 300, y: 150, w: 80, h: 60 },
  { x: 500, y: 200, w: 120, h: 50 },
  { x: 700, y: 120, w: 60, h: 90 },
  { x: 350, y: 350, w: 100, h: 70 },
  { x: 600, y: 400, w: 80, h: 80 },
  { x: 200, y: 300, w: 50, h: 50 },
  { x: 800, y: 350, w: 70, h: 60 },
  { x: 450, y: 100, w: 40, h: 40 },
];

// Pre-defined survivor locations
const SURVIVOR_LOCATIONS: { x: number; y: number; severity: SurvivorSeverity; confidence: number }[] = [
  { x: 340, y: 180, severity: 'critical', confidence: 0.92 },
  { x: 560, y: 230, severity: 'high', confidence: 0.78 },
  { x: 730, y: 160, severity: 'medium', confidence: 0.65 },
  { x: 400, y: 380, severity: 'high', confidence: 0.85 },
  { x: 640, y: 430, severity: 'critical', confidence: 0.95 },
  { x: 230, y: 330, severity: 'low', confidence: 0.55 },
  { x: 830, y: 380, severity: 'medium', confidence: 0.70 },
  { x: 470, y: 130, severity: 'low', confidence: 0.60 },
];

let survivorCounter = 0;

export class SimulationEngine {
  private units: Map<UnitId, SimUnit> = new Map();
  private alertCb: AlertCallback | null = null;
  private survivorCb: SurvivorCallback | null = null;
  private eventCb: EventCallback | null = null;
  private verificationResultCb: VerificationResultCallback | null = null;
  private running = false;
  private intervalId: number | null = null;
  private activeMission: Mission | null = null;
  private startTime = 0;
  private survivorQueue: { x: number; y: number; severity: SurvivorSeverity; confidence: number; delay: number }[] = [];
  private roverVerificationTarget: { detectionId: string; latitude: number; longitude: number; altitude: number } | null = null;
  private supplyMission: SupplyMission | null = null;

  constructor() {
    this.initUnits();
  }

  private initUnits() {
    for (const id of UNIT_IDS) {
      const cfg = UNIT_CONFIG[id];
      const { lat, lng } = gpsFormat(cfg.startX, cfg.startY);
      this.units.set(id, {
        telemetry: {
          unitId: id,
          unitType: cfg.type,
          callsign: cfg.callsign,
          name: cfg.name,
          x: cfg.startX,
          y: cfg.startY,
          altitude: id === 'ROVER_R1' ? 0 : 45 + Math.random() * 15,
          speed: 0,
          heading: 0,
          battery: 100,
          signalStrength: -55,
          gpsLat: lat,
          gpsLng: lng,
          mode: 'STANDBY',
          armed: false,
          status: 'Idle',
          trail: [],
          currentWaypoint: 0,
          thumbnail: '',
        },
        targetX: cfg.startX,
        targetY: cfg.startY,
        waypointIndex: 0,
        waypoints: [],
        missionActive: false,
        scanning: false,
        scanAngle: 0,
        scanRadius: 60,
        baseX: cfg.startX,
        baseY: cfg.startY,
        returning: false,
        delivering: false,
        deliverProgress: 0,
        batteryDrain: 0,
        lastLowBatteryAlert: 0,
        lastLinkAlert: 0,
        slamGrid: new Uint8Array(SLAM_W * SLAM_H),
        slamInitialized: false,
      });
    }
  }

  onAlert(cb: AlertCallback) {
    this.alertCb = cb;
  }

  onSurvivor(cb: SurvivorCallback) {
    this.survivorCb = cb;
  }

  onEvent(cb: EventCallback) {
    this.eventCb = cb;
  }

  onVerificationResult(cb: VerificationResultCallback) {
    this.verificationResultCb = cb;
  }

  start(mission: Mission) {
    this.activeMission = mission;
    this.startTime = Date.now();

    // Queue survivors with staggered detection delays
    this.survivorQueue = SURVIVOR_LOCATIONS.map((s, i) => ({
      ...s,
      delay: 5000 + i * 7000 + Math.random() * 3000,
    }));

    for (const id of UNIT_IDS) {
      const unit = this.units.get(id);
      if (!unit) continue;
      unit.waypoints = mission.waypoints || [];
      unit.waypointIndex = 0;
      unit.telemetry.currentWaypoint = 0;
      unit.missionActive = mission.unit_id === id;
      unit.scanning = false;
      unit.returning = false;
      unit.delivering = false;
      unit.deliverProgress = 0;

      if (mission.unit_id === id && unit.waypoints.length > 0) {
        const wp = unit.waypoints[0];
        unit.targetX = wp.x;
        unit.targetY = wp.y;
        unit.telemetry.mode = 'AUTO';
        unit.telemetry.armed = true;
        unit.telemetry.status = 'En route';
      } else {
        // Non-assigned units stay visible at base in standby.
        unit.waypoints = [];
        unit.missionActive = false;
        unit.targetX = unit.baseX;
        unit.targetY = unit.baseY;
        unit.telemetry.mode = 'STANDBY';
        unit.telemetry.armed = false;
        unit.telemetry.status = 'Idle';
        unit.telemetry.speed = 0;
        if (unit.telemetry.unitType === 'drone') unit.telemetry.altitude = 0;
      }
    }

    this.running = true;
    this.emitEvent(null, 'mission', `Mission "${mission.name}" started — ${mission.unit_id} assigned`);

    this.emitAlert({
      mission_id: mission.id,
      unit_id: null,
      type: 'mission_started',
      severity: 'success',
      message: `Mission "${mission.name}" initiated`,
    });

    if (this.intervalId === null) {
      this.intervalId = window.setInterval(() => this.tick(), 500);
    }
  }

  pause() {
    for (const id of UNIT_IDS) {
      const unit = this.units.get(id);
      if (!unit) continue;
      unit.telemetry.mode = 'LOITER';
      unit.telemetry.status = 'Idle';
    }
    this.running = false;
    this.emitEvent(null, 'mission', 'Mission paused — units holding position');
  }

  resume() {
    for (const id of UNIT_IDS) {
      const unit = this.units.get(id);
      if (!unit) continue;
      if (unit.waypoints.length > 0 && unit.waypointIndex < unit.waypoints.length) {
        unit.telemetry.mode = 'AUTO';
        unit.telemetry.status = 'En route';
      }
    }
    this.running = true;
    this.emitEvent(null, 'mission', 'Mission resumed');
  }

  abort() {
    for (const id of UNIT_IDS) {
      const unit = this.units.get(id);
      if (!unit) continue;
      unit.missionActive = false;
      unit.scanning = false;
      unit.returning = true;
      unit.targetX = unit.baseX;
      unit.targetY = unit.baseY;
      unit.telemetry.mode = 'RTL';
      unit.telemetry.status = 'Returning';
    }
    this.running = false;
    this.emitEvent(null, 'mission', 'Mission aborted — all units returning to base');
    this.emitAlert({
      mission_id: this.activeMission?.id ?? null,
      unit_id: null,
      type: 'system',
      severity: 'critical',
      message: 'Mission ABORTED — RTB initiated',
    });
  }

  returnToBase() {
    for (const id of UNIT_IDS) {
      const unit = this.units.get(id);
      if (!unit) continue;
      unit.returning = true;
      unit.targetX = unit.baseX;
      unit.targetY = unit.baseY;
      unit.telemetry.mode = 'RTL';
      unit.telemetry.status = 'Returning';
    }
    this.emitEvent(null, 'mission', 'Return to base commanded');
  }

  private generatePatrolWaypoints(id: UnitId): Waypoint[] {
    const cfg = UNIT_CONFIG[id];
    if (cfg.type === 'rover') {
      return [
        { x: 200, y: 500, label: 'P-01' },
        { x: 400, y: 480, label: 'P-02' },
        { x: 600, y: 500, label: 'P-03' },
        { x: 800, y: 480, label: 'P-04' },
        { x: 800, y: 300, label: 'P-05' },
        { x: 600, y: 280, label: 'P-06' },
        { x: 400, y: 300, label: 'P-07' },
        { x: 200, y: 280, label: 'P-08' },
      ];
    }
    return [
      { x: 300, y: 200, label: 'P-01' },
      { x: 500, y: 250, label: 'P-02' },
      { x: 700, y: 180, label: 'P-03' },
      { x: 800, y: 350, label: 'P-04' },
      { x: 600, y: 400, label: 'P-05' },
      { x: 400, y: 380, label: 'P-06' },
      { x: 250, y: 300, label: 'P-07' },
    ];
  }

  private tick() {
    const now = Date.now();
    const elapsed = now - this.startTime;

    for (const id of UNIT_IDS) {
      const unit = this.units.get(id);
      if (!unit) continue;
      this.updateUnit(unit, id, elapsed, now);
    }

    // Check for survivor detections
    if (this.running) {
      for (let i = this.survivorQueue.length - 1; i >= 0; i--) {
        if (elapsed >= this.survivorQueue[i].delay) {
          const s = this.survivorQueue[i];
          this.survivorQueue.splice(i, 1);
          this.detectSurvivor(s.x, s.y, s.severity, s.confidence);
        }
      }
    }

    // Update SLAM for rover
    this.updateSLAM();
  }

  private updateSupplyMissionState(id: UnitId, unit: SimUnit) {
    if (id !== 'MEDDROP' || !this.supplyMission) return;

    const targetPoint = latLngToMap(this.supplyMission.latitude, this.supplyMission.longitude);
    const distanceToTarget = distance(unit.telemetry.x, unit.telemetry.y, targetPoint.x, targetPoint.y);

    if (this.supplyMission.missionStatus === 'READY') {
      this.supplyMission.missionStatus = 'DISPATCHED';
      this.emitEvent('MEDDROP', 'mission', `Supply mission ${this.supplyMission.missionId} dispatched to ${this.supplyMission.survivorId}`);
    }

    if (this.supplyMission.missionStatus === 'DISPATCHED' && distanceToTarget < 180) {
      this.supplyMission.missionStatus = 'EN_ROUTE';
    }

    if (this.supplyMission.missionStatus === 'EN_ROUTE' && distanceToTarget < 30) {
      this.supplyMission.missionStatus = 'AT_TARGET';
      this.emitEvent('MEDDROP', 'mission', `Supply UAV at target for ${this.supplyMission.survivorId}`);
    }

    if (this.supplyMission.missionStatus === 'AT_TARGET' && !unit.delivering) {
      unit.delivering = true;
      unit.telemetry.status = 'Delivering';
      unit.telemetry.mode = 'DELIVERY';
      this.supplyMission.missionStatus = 'DELIVERING';
      this.emitEvent('MEDDROP', 'mission', `Supply mission ${this.supplyMission.missionId} delivering payload`);
    }

    if (unit.delivering && this.supplyMission.missionStatus === 'DELIVERING') {
      this.supplyMission.missionStatus = 'DELIVERING';
    }

    if (unit.returning && this.supplyMission.missionStatus !== 'COMPLETED') {
      this.supplyMission.missionStatus = 'RETURNING';
    }

    if (unit.returning && distance(unit.telemetry.x, unit.telemetry.y, unit.baseX, unit.baseY) < 12) {
      this.supplyMission.missionStatus = 'COMPLETED';
      this.emitEvent('MEDDROP', 'mission', `Supply mission ${this.supplyMission.missionId} complete`);
      this.emitAlert({
        mission_id: this.activeMission?.id ?? null,
        unit_id: 'MEDDROP',
        type: 'payload_delivered',
        severity: 'success',
        message: `Supply UAV mission complete for ${this.supplyMission.survivorId}`,
      });
      this.supplyMission = null;
    }
  }

  private updateUnit(unit: SimUnit, id: UnitId, elapsed: number, now: number) {
    const tm = unit.telemetry;
    this.updateSupplyMissionState(id, unit);

    // Movement
    const dx = unit.targetX - tm.x;
    const dy = unit.targetY - tm.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const speed = id === 'ROVER_R1' ? 2.5 : 4.5;
    const moveSpeed = unit.returning ? speed * 1.2 : speed;

    if (dist > 3) {
      const ratio = Math.min(1, moveSpeed / dist);
      tm.x = lerp(tm.x, unit.targetX, ratio);
      tm.y = lerp(tm.y, unit.targetY, ratio);
      tm.heading = normalizeAngle(angleBetween(tm.x, tm.y, unit.targetX, unit.targetY));
      tm.speed = moveSpeed * 10 + Math.random() * 2;
    } else {
      tm.speed = Math.max(0, tm.speed - 0.5);

      if (unit.returning) {
        tm.status = 'Idle';
        tm.mode = 'STANDBY';
        tm.armed = false;
        unit.returning = false;
        this.emitEvent(id, 'mission', `${tm.name} returned to base`);
      } else if (unit.waypoints.length > 0 && unit.waypointIndex < unit.waypoints.length) {
        // Reached waypoint
        const wp = unit.waypoints[unit.waypointIndex];
        this.emitEvent(id, 'mission', `${tm.name} reached ${wp.label}`);
        this.emitAlert({
          mission_id: this.activeMission?.id ?? null,
          unit_id: id,
          type: 'waypoint_reached',
          severity: 'info',
          message: `${tm.name} reached ${wp.label}`,
        });

        unit.waypointIndex++;
        tm.currentWaypoint = unit.waypointIndex;

        if (unit.waypointIndex < unit.waypoints.length) {
          const next = unit.waypoints[unit.waypointIndex];
          unit.targetX = next.x;
          unit.targetY = next.y;
          tm.status = unit.scanning ? 'Scanning' : 'En route';
        } else if (unit.scanning) {
          // Loop patrol
          unit.waypointIndex = 0;
          const first = unit.waypoints[0];
          unit.targetX = first.x;
          unit.targetY = first.y;
        } else if (id === 'MEDDROP' && this.activeMission?.payload) {
          // Deliver payload
          unit.delivering = true;
          tm.status = 'Delivering';
          tm.mode = 'DELIVERY';
          this.emitEvent(id, 'mission', `${tm.name} initiating payload delivery`);
        } else {
          // Mission complete for this unit
          tm.status = 'Idle';
          tm.mode = 'STANDBY';
          tm.speed = 0;
          unit.missionActive = false;
          this.emitEvent(id, 'mission', `${tm.name} mission waypoints complete`);
          this.emitAlert({
            mission_id: this.activeMission?.id ?? null,
            unit_id: id,
            type: 'mission_completed',
            severity: 'success',
            message: `${tm.name} mission complete`,
          });
        }
      }
    }

    // Delivery logic
    if (unit.delivering) {
      unit.deliverProgress += 0.05;
      if (unit.deliverProgress >= 1) {
        unit.delivering = false;
        unit.deliverProgress = 0;
        tm.status = 'Returning';
        tm.mode = 'RTL';
        unit.returning = true;
        unit.targetX = unit.baseX;
        unit.targetY = unit.baseY;
        this.emitEvent(id, 'mission', `${tm.name} payload delivered successfully`);
        this.emitAlert({
          mission_id: this.activeMission?.id ?? null,
          unit_id: id,
          type: 'payload_delivered',
          severity: 'success',
          message: `${tm.name} payload delivered`,
        });
      }
    }

    if (id === 'ROVER_R1' && this.roverVerificationTarget) {
      const target = this.roverVerificationTarget;
      if (distance(unit.telemetry.x, unit.telemetry.y, latLngToMap(target.latitude, target.longitude).x, latLngToMap(target.latitude, target.longitude).y) < 18) {
        const verificationStatus = Math.random() < 0.75 ? 'VERIFIED' : 'REJECTED';
        const verifiedAt = new Date().toISOString();
        this.verificationResultCb?.({
          detectionId: target.detectionId,
          verificationStatus,
          verifiedBy: 'ROVER_R1',
          verifiedAt,
          latitude: target.latitude,
          longitude: target.longitude,
          altitude: target.altitude,
        });
        this.emitEvent('ROVER_R1', 'verification', verificationStatus === 'VERIFIED' ? 'Survivor confirmed by Rover R1' : 'No survivor confirmed by Rover R1');
        this.roverVerificationTarget = null;
        unit.missionActive = false;
        unit.returning = true;
        unit.targetX = unit.baseX;
        unit.targetY = unit.baseY;
        tm.status = 'Returning';
        tm.mode = 'RTL';
      }
    }

    // Battery drain
    const drainRate = unit.missionActive || unit.returning ? (id === 'ROVER_R1' ? 0.04 : 0.06) : 0;
    const movingMultiplier = tm.speed > 1 ? 1.5 : 0.5;
    tm.battery = Math.max(0, tm.battery - drainRate * movingMultiplier);

    // Low battery alert
    if (tm.battery < 25 && now - unit.lastLowBatteryAlert > 15000) {
      unit.lastLowBatteryAlert = now;
      this.emitAlert({
        mission_id: this.activeMission?.id ?? null,
        unit_id: id,
        type: 'low_battery',
        severity: 'warning',
        message: `${tm.name} battery low: ${tm.battery.toFixed(0)}%`,
      });
      this.emitEvent(id, 'alert', `${tm.name} low battery warning: ${tm.battery.toFixed(0)}%`);
    }

    // Auto RTB on critical battery
    if (tm.battery < 10 && !unit.returning) {
      unit.returning = true;
      unit.targetX = unit.baseX;
      unit.targetY = unit.baseY;
      tm.mode = 'RTL';
      tm.status = 'Returning';
      this.emitAlert({
        mission_id: this.activeMission?.id ?? null,
        unit_id: id,
        type: 'low_battery',
        severity: 'critical',
        message: `${tm.name} critical battery — auto RTB`,
      });
    }

    // Signal strength fluctuation
    tm.signalStrength = -55 + Math.sin(elapsed / 3000 + id.length) * 8 + (Math.random() - 0.5) * 4;

    // Occasional link degradation
    if (Math.random() < 0.003 && now - unit.lastLinkAlert > 20000) {
      unit.lastLinkAlert = now;
      tm.signalStrength = -90 + Math.random() * 5;
      this.emitAlert({
        mission_id: this.activeMission?.id ?? null,
        unit_id: id,
        type: 'link_lost',
        severity: 'critical',
        message: `${tm.name} telemetry link degraded`,
      });
      this.emitEvent(id, 'alert', `${tm.name} link degradation detected`);
    }

    // Altitude for drones
    if (unit.telemetry.unitType === 'drone' && unit.missionActive && !unit.returning) {
      tm.altitude = Math.max(0, 40 + Math.sin(elapsed / 5000) * 10 + Math.random() * 3);
    } else if (unit.telemetry.unitType === 'drone' && unit.returning) {
      tm.altitude = Math.max(0, tm.altitude - 0.5);
    }

    // GPS update
    const gps = gpsFormat(tm.x, tm.y);
    tm.gpsLat = gps.lat;
    tm.gpsLng = gps.lng;

    // Trail
    if (tm.speed > 0.5) {
      tm.trail.push({ x: tm.x, y: tm.y, ts: now });
      if (tm.trail.length > 80) tm.trail.shift();
    }

    // Scan animation
    if (unit.scanning || tm.status === 'Scanning') {
      unit.scanAngle = (unit.scanAngle + 4) % 360;
    }
  }

  private detectSurvivor(x: number, y: number, severity: SurvivorSeverity, confidence: number) {
    survivorCounter++;
    const survivorId = `S-${String(survivorCounter).padStart(3, '0')}`;

    // Prefer the Scout UAV as the source unit for the detection flow.
    const scoutSourceUnit: UnitId = 'SCOUT_S1';

    // Find nearest unit for fallback when the Scout UAV is unavailable.
    let nearestUnit: UnitId = scoutSourceUnit;
    let nearestDist = Infinity;
    for (const id of UNIT_IDS) {
      const unit = this.units.get(id);
      if (!unit) continue;
      const d = distance(unit.telemetry.x, unit.telemetry.y, x, y);
      if (d < nearestDist) {
        nearestDist = d;
        nearestUnit = id;
      }
    }

    const detectionSourceUnit = this.units.has('SCOUT_S1') ? scoutSourceUnit : nearestUnit;

    this.emitAlert({
      mission_id: this.activeMission?.id ?? null,
      unit_id: detectionSourceUnit,
      type: 'survivor_found',
      severity: severity === 'critical' ? 'critical' : 'success',
      message: `Survivor ${survivorId} detected by ${UNIT_CONFIG[detectionSourceUnit].name}`,
    });

    this.emitEvent(detectionSourceUnit, 'survivor', `Survivor ${survivorId} detected — ${severity} severity, ${(confidence * 100).toFixed(0)}% confidence`);

    if (this.survivorCb) {
      this.survivorCb({
        mission_id: this.activeMission?.id ?? null,
        survivor_id: survivorId,
        lat: x,
        lng: y,
        detected_by: detectionSourceUnit,
        confidence,
        severity,
        medicine_dispatched: false,
        status: 'reported' as SurvivorStatus,
        detected_at: new Date().toISOString(),
      });
    }
  }

  private updateSLAM() {
    const rover = this.units.get('ROVER_R1');
    if (!rover) return;

    if (!rover.slamInitialized) {
      // Initialize with obstacles
      for (const obs of OBSTACLES) {
        const x0 = Math.floor(obs.x / SLAM_CELL);
        const y0 = Math.floor(obs.y / SLAM_CELL);
        const x1 = Math.floor((obs.x + obs.w) / SLAM_CELL);
        const y1 = Math.floor((obs.y + obs.h) / SLAM_CELL);
        for (let y = y0; y <= y1 && y < SLAM_H; y++) {
          for (let x = x0; x <= x1 && x < SLAM_W; x++) {
            if (x >= 0 && y >= 0) rover.slamGrid[y * SLAM_W + x] = 2; // obstacle
          }
        }
      }
      rover.slamInitialized = true;
    }

    // Mark cells around rover as explored
    const rx = Math.floor(rover.telemetry.x / SLAM_CELL);
    const ry = Math.floor(rover.telemetry.y / SLAM_CELL);
    const sensorRange = 3;
    for (let dy = -sensorRange; dy <= sensorRange; dy++) {
      for (let dx = -sensorRange; dx <= sensorRange; dx++) {
        const x = rx + dx;
        const y = ry + dy;
        if (x < 0 || x >= SLAM_W || y < 0 || y >= SLAM_H) continue;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > sensorRange) continue;
        const idx = y * SLAM_W + x;
        if (rover.slamGrid[idx] === 0) {
          rover.slamGrid[idx] = 1; // explored/free
        }
      }
    }
  }

  getSLAMMap(): OccupancyMap {
    const rover = this.units.get('ROVER_R1');
    if (!rover) return { grid: new Uint8Array(SLAM_W * SLAM_H), width: SLAM_W, height: SLAM_H, cellSize: SLAM_CELL };
    return { grid: rover.slamGrid, width: SLAM_W, height: SLAM_H, cellSize: SLAM_CELL };
  }

  assignRoverVerificationMission(mission: RoverVerificationMission) {
    const rover = this.units.get('ROVER_R1');
    if (!rover) return;

    const target = latLngToMap(mission.targetLatitude, mission.targetLongitude);
    rover.targetX = target.x;
    rover.targetY = target.y;
    rover.missionActive = true;
    rover.returning = false;
    rover.telemetry.mode = 'AUTO';
    rover.telemetry.status = 'En route';
    rover.telemetry.armed = true;
    rover.telemetry.currentWaypoint = 0;
    rover.waypointIndex = 0;
    rover.waypoints = [{
      x: target.x,
      y: target.y,
      label: `VERIFY-${mission.targetDetectionId}`,
      latitude: mission.targetLatitude,
      longitude: mission.targetLongitude,
      altitude: mission.targetAltitude,
    }];
    this.roverVerificationTarget = {
      detectionId: mission.targetDetectionId,
      latitude: mission.targetLatitude,
      longitude: mission.targetLongitude,
      altitude: mission.targetAltitude,
    };

    this.emitEvent('ROVER_R1', 'mission', `Rover verification mission created for detection ${mission.targetDetectionId}`);
    this.emitAlert({
      mission_id: this.activeMission?.id ?? null,
      unit_id: 'ROVER_R1',
      type: 'mission_started',
      severity: 'info',
      message: `Rover verification mission assigned to ${mission.targetDetectionId}`,
    });
  }

  assignSupplyMission(mission: SupplyMission) {
    const meddrop = this.units.get('MEDDROP');
    if (!meddrop) return;

    const target = latLngToMap(mission.latitude, mission.longitude);
    meddrop.targetX = target.x;
    meddrop.targetY = target.y;
    meddrop.missionActive = true;
    meddrop.returning = false;
    meddrop.delivering = false;
    meddrop.deliverProgress = 0;
    meddrop.telemetry.mode = 'AUTO';
    meddrop.telemetry.status = 'En route';
    meddrop.telemetry.armed = true;
    meddrop.telemetry.currentWaypoint = 0;
    meddrop.waypointIndex = 0;
    meddrop.waypoints = [{
      x: target.x,
      y: target.y,
      label: `SUPPLY-${mission.survivorId}`,
      latitude: mission.latitude,
      longitude: mission.longitude,
      altitude: mission.altitude,
    }];

    this.supplyMission = {
      ...mission,
      missionStatus: 'READY',
    };

    this.emitEvent('MEDDROP', 'mission', `Autonomous supply mission created for ${mission.survivorId} and marked READY`);
    this.emitAlert({
      mission_id: this.activeMission?.id ?? null,
      unit_id: 'MEDDROP',
      type: 'mission_started',
      severity: 'success',
      message: `Supply UAV mission ready for ${mission.survivorId}`,
    });
  }

  getSupplyMission(): SupplyMission | null {
    return this.supplyMission;
  }

  private emitAlert(alert: Omit<Alert, 'id' | 'acknowledged' | 'created_at'>) {
    if (this.alertCb) this.alertCb(alert);
  }

  private emitEvent(unitId: UnitId | null, type: string, message: string, data?: Record<string, unknown>) {
    if (this.eventCb) this.eventCb({ unit_id: unitId, type, message, data });
  }

  getTelemetry(): UnitTelemetry[] {
    return UNIT_IDS.map((id) => this.units.get(id)!.telemetry);
  }

  getUnit(id: UnitId): UnitTelemetry | null {
    return this.units.get(id)?.telemetry ?? null;
  }

  setUnitPosition(unitId: UnitId, latitude: number, longitude: number, altitude?: number) {
    const unit = this.units.get(unitId);
    if (!unit) return;

    const point = latLngToMap(latitude, longitude);
    unit.telemetry.x = Math.max(0, Math.min(MAP_WIDTH, point.x));
    unit.telemetry.y = Math.max(0, Math.min(MAP_HEIGHT, point.y));
    unit.telemetry.gpsLat = Number(latitude).toFixed(5);
    unit.telemetry.gpsLng = Number(longitude).toFixed(5);

    if (typeof altitude === 'number' && Number.isFinite(altitude)) {
      unit.telemetry.altitude = Math.max(0, altitude);
    }

    unit.targetX = unit.telemetry.x;
    unit.targetY = unit.telemetry.y;
    unit.telemetry.mode = 'MANUAL';
    unit.telemetry.status = 'Idle';
  }

  isRunning(): boolean {
    return this.running;
  }

  stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.running = false;
  }

  getElapsed(): number {
    return this.startTime ? Date.now() - this.startTime : 0;
  }

  getObstacles() {
    return OBSTACLES;
  }
}

export const simulation = new SimulationEngine();
