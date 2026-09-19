import { useEffect, useMemo, useState } from 'react';
import type { GeofencePoint, Survivor, UnitId, UnitTelemetry, Waypoint } from '@/types';
import { UNIT_IDS, UNIT_CONFIG, generateWaypointLabel, defaultGeofence, latLngToMap, mapToLatLng } from '@/lib/constants';
import { MapPin, Trash2, Play, Pause, OctagonX, Home, Package, Route, Crosshair, Radar } from 'lucide-react';

interface MissionPlannerProps {
  waypoints: Waypoint[];
  onWaypointsChange: (wps: Waypoint[]) => void;
  survivors?: Survivor[];
  selectedUnit: UnitId;
  onUnitChange: (unit: UnitId) => void;
  missionName: string;
  onMissionNameChange: (name: string) => void;
  payload: string;
  onPayloadChange: (p: string) => void;
  missionMode?: 'AUTONOMOUS' | 'MANUAL';
  onMissionModeChange?: (mode: 'AUTONOMOUS' | 'MANUAL') => void;
  missionActive: boolean;
  missionPaused: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onAbort: () => void;
  onReturnToBase: () => void;
  readOnly: boolean;
  hasActiveMission: boolean;
  selectedTelemetry?: UnitTelemetry;
  missionComplete?: boolean;
  geofence?: GeofencePoint[];
  geofenceEditing?: boolean;
  onGeofenceChange?: (points: GeofencePoint[]) => void;
  onGeofenceEditingChange?: (editing: boolean) => void;
  onApplyUnitPosition?: (unitId: UnitId, latitude: number, longitude: number, altitude: number) => void;
  onAddWaypointFromCoords?: (latitude: number, longitude: number, altitude: number) => void;
}

export function MissionPlanner({
  waypoints,
  onWaypointsChange,
  survivors = [],
  selectedUnit,
  onUnitChange,
  missionName,
  onMissionNameChange,
  payload,
  onPayloadChange,
  missionMode: controlledMissionMode,
  onMissionModeChange,
  missionActive,
  missionPaused,
  onStart,
  onPause,
  onResume,
  onAbort,
  onReturnToBase,
  readOnly,
  hasActiveMission,
  selectedTelemetry,
  missionComplete = false,
  geofence = defaultGeofence(),
  onApplyUnitPosition,
  onAddWaypointFromCoords,
}: MissionPlannerProps) {
  const [planningMode] = useState(!hasActiveMission);
  const [missionMode, setMissionMode] = useState<'autonomous' | 'manual'>(controlledMissionMode === 'MANUAL' ? 'manual' : 'autonomous');
  const [selectedVerifiedSurvivorId, setSelectedVerifiedSurvivorId] = useState<string>('');
  const [missionType, setMissionType] = useState<'supply' | 'verification' | 'search'>('supply');
  const [unitDraft, setUnitDraft] = useState({
    lat: selectedTelemetry ? Number.parseFloat(selectedTelemetry.gpsLat) : 28.6139,
    lng: selectedTelemetry ? Number.parseFloat(selectedTelemetry.gpsLng) : 77.209,
    altitude: selectedTelemetry?.altitude ?? 0,
  });
  const [waypointDraft, setWaypointDraft] = useState({
    lat: 28.6139,
    lng: 77.209,
    altitude: 30,
  });
  const [targetDraft, setTargetDraft] = useState({
    lat: 28.6139,
    lng: 77.209,
    altitude: 50,
  });
  const [manualMission, setManualMission] = useState({
    name: 'Manual Supply Mission',
    latitude: 28.6139,
    longitude: 77.209,
    altitude: 50,
    payload: 'Emergency Medical Kit',
  });

  useEffect(() => {
    if (!selectedTelemetry) return;
    setUnitDraft({
      lat: Number.parseFloat(selectedTelemetry.gpsLat),
      lng: Number.parseFloat(selectedTelemetry.gpsLng),
      altitude: selectedTelemetry.altitude,
    });
  }, [selectedTelemetry]);

  useEffect(() => {
    if (controlledMissionMode === 'MANUAL') {
      setMissionMode('manual');
    } else if (controlledMissionMode === 'AUTONOMOUS') {
      setMissionMode('autonomous');
    }
  }, [controlledMissionMode]);

  const verifiedSurvivors = useMemo(
    () => survivors.filter((survivor) => survivor.verificationStatus === 'VERIFIED' || survivor.status === 'verified'),
    [survivors]
  );

  const selectedVerifiedSurvivor = useMemo(
    () => verifiedSurvivors.find((survivor) => survivor.id === selectedVerifiedSurvivorId) ?? verifiedSurvivors[0] ?? null,
    [selectedVerifiedSurvivorId, verifiedSurvivors]
  );

  useEffect(() => {
    if (verifiedSurvivors.length === 0) {
      setSelectedVerifiedSurvivorId('');
      return;
    }

    if (!selectedVerifiedSurvivorId && verifiedSurvivors[0]) {
      setSelectedVerifiedSurvivorId(verifiedSurvivors[0].id);
    }
  }, [selectedVerifiedSurvivorId, verifiedSurvivors]);

  useEffect(() => {
    if (!selectedVerifiedSurvivor) return;

    const survivorAltitude = 50;
    setTargetDraft((prev) => ({
      ...prev,
      lat: Number(selectedVerifiedSurvivor.lat),
      lng: Number(selectedVerifiedSurvivor.lng),
      altitude: survivorAltitude,
    }));
    setManualMission((prev) => ({
      ...prev,
      latitude: Number(selectedVerifiedSurvivor.lat),
      longitude: Number(selectedVerifiedSurvivor.lng),
      altitude: prev.altitude || survivorAltitude,
    }));
  }, [selectedVerifiedSurvivor]);

  const routeSummary = useMemo(() => {
    if (waypoints.length < 2) {
      return { distance: 0, eta: 0, maxAltitude: selectedTelemetry?.altitude ?? 0 };
    }

    let distanceMeters = 0;
    for (let i = 1; i < waypoints.length; i++) {
      const a = waypoints[i - 1];
      const b = waypoints[i];
      distanceMeters += Math.hypot(b.x - a.x, b.y - a.y) * 1.3;
    }

    const avgSpeed = selectedTelemetry?.speed && selectedTelemetry.speed > 0 ? selectedTelemetry.speed : 12;
    const etaMinutes = Math.max(1, Math.round((distanceMeters / avgSpeed) / 60));
    const maxAltitude = Math.max(
      selectedTelemetry?.altitude ?? 0,
      ...waypoints.map((wp) => wp.altitude ?? 0)
    );

    return { distance: distanceMeters, eta: etaMinutes, maxAltitude };
  }, [selectedTelemetry, waypoints]);

  const validationSummary = useMemo(() => {
    const latOk = Number.isFinite(Number(manualMission.latitude)) && Math.abs(Number(manualMission.latitude)) <= 90;
    const lngOk = Number.isFinite(Number(manualMission.longitude)) && Math.abs(Number(manualMission.longitude)) <= 180;
    const altOk = Number.isFinite(Number(manualMission.altitude)) && Number(manualMission.altitude) > 0 && Number(manualMission.altitude) <= 3000;
    const routeOk = waypoints.length >= 2;
    const batteryOk = !selectedTelemetry || selectedTelemetry.battery >= 25;
    const supplyAvailable = selectedUnit === 'MEDDROP';

    const geofenceTarget = waypoints[waypoints.length - 1] ?? {
      x: 0,
      y: 0,
      label: 'TARGET',
      latitude: Number(manualMission.latitude),
      longitude: Number(manualMission.longitude),
      altitude: Number(manualMission.altitude),
    };
    const targetPoint = geofenceTarget.latitude !== undefined && geofenceTarget.longitude !== undefined
      ? latLngToMap(geofenceTarget.latitude, geofenceTarget.longitude)
      : { x: 0, y: 0 };

    let insideGeofence = geofence.length >= 3;
    if (geofence.length >= 3) {
      let inside = false;
      for (let i = 0, j = geofence.length - 1; i < geofence.length; j = i++) {
        const xi = geofence[i].x;
        const yi = geofence[i].y;
        const xj = geofence[j].x;
        const yj = geofence[j].y;
        const intersect = ((yi > targetPoint.y) !== (yj > targetPoint.y)) &&
          (targetPoint.x < ((xj - xi) * (targetPoint.y - yi)) / (yj - yi + Number.EPSILON) + xi);
        if (intersect) inside = !inside;
      }
      insideGeofence = inside;
    }

    const geofenceOk = insideGeofence;
    const gpsValid = latOk && lngOk;

    return {
      gpsValid,
      routeValid: routeOk,
      geofenceValid: geofenceOk,
      batterySufficient: batteryOk,
      supplyAvailable,
      allValid: gpsValid && altOk && routeOk && geofenceOk && batteryOk && supplyAvailable,
      reasons: [
        !gpsValid ? 'Latitude or longitude invalid' : null,
        !altOk ? 'Altitude invalid' : null,
        !routeOk ? 'Route missing' : null,
        !geofenceOk ? 'Target outside geofence' : null,
        !batteryOk ? 'Supply UAV battery below threshold' : null,
        !supplyAvailable ? 'Supply UAV unavailable' : null,
      ].filter(Boolean) as string[],
    };
  }, [geofence, manualMission, selectedTelemetry, selectedUnit, waypoints]);

  const removeWaypoint = (index: number) => {
    const updated = waypoints.filter((_, i) => i !== index);
    const relabeled = updated.map((wp, i) => ({ ...wp, label: generateWaypointLabel(i) }));
    onWaypointsChange(relabeled);
  };

  const clearWaypoints = () => {
    onWaypointsChange([]);
  };

  const autoGenerateMissionFromTarget = () => {
    const latitude = Number(targetDraft.lat);
    const longitude = Number(targetDraft.lng);
    const altitude = Number(targetDraft.altitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(altitude)) return;

    const center = latLngToMap(latitude, longitude);
    const offsets = [
      { x: 0, y: 0 },
      { x: 90, y: -70 },
      { x: 150, y: 60 },
      { x: -80, y: 110 },
      { x: -150, y: -40 },
      { x: 70, y: 180 },
    ];

    const generated = offsets.map((offset, index) => {
      const px = Math.max(40, Math.min(960, center.x + offset.x));
      const py = Math.max(40, Math.min(660, center.y + offset.y));
      const coord = mapToLatLng(px, py);
      return {
        x: px,
        y: py,
        label: generateWaypointLabel(index),
        latitude: coord.lat,
        longitude: coord.lng,
        altitude: altitude + index * 10,
      } satisfies Waypoint;
    });

    onWaypointsChange(generated);
    onMissionNameChange(missionType === 'verification' ? 'ROVER VERIFICATION' : 'SUPPLY DELIVERY');
  };

  const createManualSupplyMission = () => {
    const latitude = Number(manualMission.latitude);
    const longitude = Number(manualMission.longitude);
    const altitude = Number(manualMission.altitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(altitude)) return;

    const center = latLngToMap(latitude, longitude);
    const generated = [
      { x: center.x, y: center.y, label: 'LZ-01', latitude, longitude, altitude },
      { x: Math.min(960, center.x + 90), y: Math.max(80, center.y - 50), label: 'LZ-02', latitude: latitude + 0.0002, longitude: longitude + 0.00018, altitude: altitude + 10 },
      { x: Math.min(960, center.x + 170), y: Math.min(620, center.y + 30), label: 'LZ-03', latitude: latitude + 0.00038, longitude: longitude + 0.00032, altitude: altitude + 15 },
    ] as Waypoint[];

    onWaypointsChange(generated);
    onMissionNameChange(manualMission.name || 'Manual Supply Mission');
    onPayloadChange(manualMission.payload || 'Emergency Medical Kit');
    onUnitChange('MEDDROP');
    setMissionMode('manual');
    setMissionType('supply');
  };

  const handleApplyUnitPosition = () => {
    if (!onApplyUnitPosition) return;
    const latitude = Number(unitDraft.lat);
    const longitude = Number(unitDraft.lng);
    const altitude = Number(unitDraft.altitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(altitude)) return;
    onApplyUnitPosition(selectedUnit, latitude, longitude, altitude);
  };

  const handleAddWaypointFromCoords = () => {
    if (!onAddWaypointFromCoords) return;
    const latitude = Number(waypointDraft.lat);
    const longitude = Number(waypointDraft.lng);
    const altitude = Number(waypointDraft.altitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(altitude)) return;
    onAddWaypointFromCoords(latitude, longitude, altitude);
  };

  const canStart = waypoints.length > 0 && missionName.trim().length > 0 && !missionActive && !readOnly && (!selectedUnit || selectedUnit !== 'MEDDROP' || validationSummary.allValid);

  const workflowState = (() => {
    if (missionComplete) return 'COMPLETED';
    if (selectedTelemetry?.status === 'Delivering') return 'DELIVERING';
    if (selectedTelemetry?.status === 'Returning') return 'RETURNING';
    if (selectedTelemetry?.status === 'En route') return 'EN ROUTE';
    if (selectedVerifiedSurvivor?.verificationStatus === 'VERIFIED') return 'VERIFIED';
    if (selectedVerifiedSurvivor?.detectionState === 'VERIFYING') return 'VERIFYING';
    if (selectedVerifiedSurvivor?.detectionState === 'DETECTED') return 'DETECTED';
    if (selectedUnit === 'SCOUT_S1') return 'DETECTED';
    if (selectedUnit === 'ROVER_R1') return 'VERIFYING';
    if (selectedUnit === 'MEDDROP') return 'SUPPLY';
    return 'STANDBY';
  })();

  return (
    <div className="panel h-full min-h-0 flex flex-col">
      <div className="panel-header">
        <span className="panel-title">RESQ X Mission Hub</span>
        {missionActive && (
          <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
            MISSION ACTIVE
          </span>
        )}
        {missionPaused && (
          <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
            PAUSED
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin p-3 space-y-3">
        <div className="rounded-md border border-white/10 bg-bg-tertiary p-2.5">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-400 mb-2">
            <Radar className="w-3.5 h-3.5 text-accent-amber" />
            <span>Mission mode</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setMissionMode('autonomous');
                onMissionModeChange?.('AUTONOMOUS');
              }}
              className={`btn text-[10px] ${missionMode === 'autonomous' ? 'btn-primary' : 'btn-secondary'}`}
            >
              AUTONOMOUS
            </button>
            <button
              onClick={() => {
                setMissionMode('manual');
                onMissionModeChange?.('MANUAL');
              }}
              className={`btn text-[10px] ${missionMode === 'manual' ? 'btn-primary' : 'btn-secondary'}`}
            >
              MANUAL
            </button>
          </div>
          <div className="mt-2 rounded border border-white/10 bg-bg-primary/60 px-2 py-1.5">
            <div className="flex items-center justify-between gap-1 text-[9px] font-mono uppercase tracking-[0.18em] text-slate-500">
              <span className={missionMode === 'autonomous' ? 'text-accent-amber' : 'text-slate-400'}>SCOUT UAV</span>
              <span>→</span>
              <span className={missionMode === 'autonomous' ? 'text-accent-blue' : 'text-slate-400'}>ROVER R1</span>
              <span>→</span>
              <span className={missionMode === 'autonomous' ? 'text-accent-green' : 'text-slate-400'}>SUPPLY UAV</span>
            </div>
            <div className="mt-1 text-[9px] font-mono uppercase tracking-[0.14em] text-slate-500">
              {missionMode === 'autonomous' ? 'AUTONOMOUS RESCUE FLOW' : 'MANUAL SUPPLY FLOW'}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">Mission Name</label>
          <input
            type="text"
            value={missionName}
            onChange={(e) => onMissionNameChange(e.target.value)}
            className="input"
            placeholder="Operation Phoenix"
            disabled={missionActive || readOnly}
          />
        </div>

        {verifiedSurvivors.length > 0 && (
          <div className="rounded-md border border-white/10 bg-bg-tertiary p-2.5 space-y-2">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-400">
              <Crosshair className="w-3.5 h-3.5 text-accent-cyan" />
              <span>Verified survivor target</span>
            </div>
            <select
              value={selectedVerifiedSurvivorId}
              onChange={(e) => setSelectedVerifiedSurvivorId(e.target.value)}
              className="input text-[10px]"
              disabled={readOnly || missionActive}
            >
              {verifiedSurvivors.map((survivor) => (
                <option key={survivor.id} value={survivor.id}>
                  {survivor.survivor_id} · {Number(survivor.lat).toFixed(5)}, {Number(survivor.lng).toFixed(5)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="rounded-md border border-white/10 bg-bg-tertiary p-2.5 space-y-2">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-400">
            <Package className="w-3.5 h-3.5 text-accent-blue" />
            <span>Mission type</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['supply', 'verification', 'search'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setMissionType(type)}
                className={`text-[9px] uppercase tracking-wide rounded-md border px-2 py-1.5 ${
                  missionType === type ? 'border-accent-amber bg-accent-amber/10 text-accent-amber' : 'border-white/10 bg-white/[0.02] text-slate-400'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Assigned Unit</label>
          <div className="grid grid-cols-3 gap-1.5">
            {UNIT_IDS.map((id) => {
              const cfg = UNIT_CONFIG[id];
              const selected = selectedUnit === id;
              const title = id === 'SCOUT_S1' ? 'SCOUT UAV' : id === 'ROVER_R1' ? 'ROVER R1' : id === 'MEDDROP' ? 'SUPPLY UAV' : cfg.name;
              return (
                <button
                  key={id}
                  onClick={() => onUnitChange(id)}
                  disabled={missionActive || readOnly}
                  className={`p-2.5 rounded-md border text-center transition-all ${
                    selected
                      ? 'border-accent-amber bg-accent-amber/10 shadow-[0_0_16px_rgba(245,158,11,0.16)]'
                      : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                  } ${missionActive || readOnly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="h-10 flex items-center justify-center mb-1.5">
                    {id === 'MEDDROP' ? <MedicalDroneIcon active={selected} /> : id === 'RECON' ? <DroneIcon active={selected} /> : <RoverIcon active={selected} />}
                  </div>
                  <div className="text-[10px] font-semibold text-white font-condensed">{title}</div>
                  <div className="text-[8px] text-slate-500 font-mono">{cfg.callsign}</div>
                </button>
              );
            })}
          </div>
        </div>

        {missionMode === 'autonomous' ? (
          <div className="rounded-md border border-white/10 bg-bg-tertiary p-2.5 space-y-2">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-400">
              <ShieldIcon />
              <span>Autonomous workflow</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <StatusMetric label="DETECT" value={selectedVerifiedSurvivor?.detectionState === 'DETECTED' || selectedVerifiedSurvivor ? 'DETECTED' : 'STANDBY'} tone="amber" />
              <StatusMetric label="VERIFY" value={selectedVerifiedSurvivor?.verificationStatus === 'VERIFIED' ? 'VERIFIED' : selectedVerifiedSurvivor?.detectionState === 'VERIFYING' ? 'VERIFYING' : 'READY'} tone="cyan" />
              <StatusMetric label="SUPPLY" value={selectedUnit === 'MEDDROP' ? 'READY' : 'PENDING'} tone="green" />
              <StatusMetric label="STATE" value={workflowState} tone={workflowState === 'COMPLETED' ? 'green' : workflowState === 'DELIVERING' || workflowState === 'RETURNING' || workflowState === 'EN ROUTE' ? 'amber' : 'slate'} />
            </div>
            <button
              onClick={autoGenerateMissionFromTarget}
              className="btn btn-primary w-full justify-center text-[10px]"
              disabled={readOnly || missionActive}
            >
              <Radar className="w-3.5 h-3.5" /> Create supply mission from verified target
            </button>
            <button
              onClick={() => {
                setMissionType('verification');
                onMissionNameChange('ROVER VERIFICATION');
              }}
              className="btn btn-secondary w-full justify-center text-[10px]"
              disabled={readOnly || missionActive}
            >
              <Route className="w-3.5 h-3.5" /> Create verification mission
            </button>
          </div>
        ) : (
          <div className="rounded-md border border-white/10 bg-bg-tertiary p-2.5 space-y-2">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-400">
              <Package className="w-3.5 h-3.5 text-accent-amber" />
              <span>Manual Supply Mission</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] text-slate-500 uppercase tracking-wider mb-1">Mission Name</label>
                <input value={manualMission.name} onChange={(e) => setManualMission((prev) => ({ ...prev, name: e.target.value }))} className="input text-xs" />
              </div>
              <div>
                <label className="block text-[9px] text-slate-500 uppercase tracking-wider mb-1">Payload</label>
                <input value={manualMission.payload} onChange={(e) => setManualMission((prev) => ({ ...prev, payload: e.target.value }))} className="input text-xs" />
              </div>
              <div>
                <label className="block text-[9px] text-slate-500 uppercase tracking-wider mb-1">Latitude</label>
                <input value={manualMission.latitude} onChange={(e) => setManualMission((prev) => ({ ...prev, latitude: Number(e.target.value) }))} className="input text-xs" />
              </div>
              <div>
                <label className="block text-[9px] text-slate-500 uppercase tracking-wider mb-1">Longitude</label>
                <input value={manualMission.longitude} onChange={(e) => setManualMission((prev) => ({ ...prev, longitude: Number(e.target.value) }))} className="input text-xs" />
              </div>
              <div className="col-span-2">
                <label className="block text-[9px] text-slate-500 uppercase tracking-wider mb-1">Altitude (m)</label>
                <input value={manualMission.altitude} onChange={(e) => setManualMission((prev) => ({ ...prev, altitude: Number(e.target.value) }))} className="input text-xs" type="number" />
              </div>
            </div>
            <button onClick={createManualSupplyMission} className="btn btn-primary w-full justify-center text-[10px]" disabled={readOnly || missionActive}>
              <Play className="w-3.5 h-3.5" /> Create manual supply mission
            </button>
          </div>
        )}

        <div className="rounded-md border border-white/10 bg-bg-tertiary p-2.5 space-y-2">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-400">
            <ShieldIcon />
            <span>Validation</span>
          </div>
          <div className="space-y-1 text-[10px] font-mono text-slate-300">
            <div className={validationSummary.gpsValid ? 'text-accent-green' : 'text-accent-red'}>✓ GPS VALID</div>
            <div className={validationSummary.routeValid ? 'text-accent-green' : 'text-accent-red'}>✓ ROUTE VALID</div>
            <div className={validationSummary.geofenceValid ? 'text-accent-green' : 'text-accent-red'}>✓ GEOFENCE VALID</div>
            <div className={validationSummary.supplyAvailable ? 'text-accent-green' : 'text-accent-red'}>✓ UAV AVAILABLE</div>
            <div className={validationSummary.batterySufficient ? 'text-accent-green' : 'text-accent-red'}>✓ BATTERY OK</div>
          </div>
          {!validationSummary.allValid && (
            <div className="rounded-md border border-accent-red/30 bg-accent-red/5 px-2 py-1.5 text-[10px] text-accent-red font-mono">
              MISSION BLOCKED — {validationSummary.reasons[0]}
            </div>
          )}
        </div>

        <div className="rounded-md border border-white/10 bg-bg-tertiary p-2.5">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-400 mb-1.5">
            <ShieldIcon />
            <span>Workflow</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {['DETECT', 'VERIFY', 'SUPPLY', 'DELIVER', 'RETURN'].map((step, index) => {
              const active = index <= ['DETECT', 'VERIFY', 'SUPPLY', 'DELIVER', 'RETURN'].indexOf(workflowState === 'STANDBY' ? 'DETECT' : workflowState);
              return (
                <span
                  key={step}
                  className={`inline-flex items-center rounded border px-2 py-1 text-[9px] font-mono uppercase tracking-[0.16em] ${
                    active
                      ? step === 'VERIFY' ? 'border-accent-blue bg-accent-blue/10 text-accent-blue' : step === 'SUPPLY' ? 'border-accent-green bg-accent-green/10 text-accent-green' : step === 'DELIVER' ? 'border-accent-amber bg-accent-amber/10 text-accent-amber' : step === 'RETURN' ? 'border-slate-600 bg-slate-500/10 text-slate-300' : 'border-accent-amber bg-accent-amber/10 text-accent-amber'
                      : 'border-white/10 bg-white/[0.02] text-slate-500'
                  }`}
                >
                  {step}
                </span>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 border-t border-white/5 pt-3">
          <TelemetryMetric label="Distance" value={waypoints.length > 1 ? `${(routeSummary.distance / 1000).toFixed(1)}km` : '0.0km'} />
          <TelemetryMetric label="ETA" value={`${routeSummary.eta} min`} />
          <TelemetryMetric label="Peak Alt" value={`${routeSummary.maxAltitude.toFixed(0)}m`} />
        </div>

        {(missionActive || missionComplete) && selectedTelemetry && (
          <div className="grid grid-cols-3 gap-1.5">
            <TelemetryMetric label="Battery" value={`${selectedTelemetry.battery.toFixed(0)}%`} />
            <TelemetryMetric label={selectedTelemetry.unitType === 'drone' ? 'Altitude' : 'Speed'} value={selectedTelemetry.unitType === 'drone' ? `${selectedTelemetry.altitude.toFixed(0)}m` : `${selectedTelemetry.speed.toFixed(1)}m/s`} />
            <TelemetryMetric label="Speed" value={`${selectedTelemetry.speed.toFixed(1)}m/s`} />
          </div>
        )}

        <div className="rounded-md border border-white/10 bg-bg-tertiary p-2.5 space-y-2">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-400">
            <Crosshair className="w-3.5 h-3.5 text-accent-blue" />
            <span>Unit Position Override</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[9px] text-slate-500 uppercase tracking-wider mb-1">Latitude</label>
              <input value={unitDraft.lat} onChange={(e) => setUnitDraft((prev) => ({ ...prev, lat: Number(e.target.value) }))} className="input text-xs" />
            </div>
            <div>
              <label className="block text-[9px] text-slate-500 uppercase tracking-wider mb-1">Longitude</label>
              <input value={unitDraft.lng} onChange={(e) => setUnitDraft((prev) => ({ ...prev, lng: Number(e.target.value) }))} className="input text-xs" />
            </div>
            <div className="col-span-2">
              <label className="block text-[9px] text-slate-500 uppercase tracking-wider mb-1">Altitude (m)</label>
              <input value={unitDraft.altitude} onChange={(e) => setUnitDraft((prev) => ({ ...prev, altitude: Number(e.target.value) }))} className="input text-xs" type="number" />
            </div>
          </div>
          <button onClick={handleApplyUnitPosition} disabled={readOnly || missionActive} className="btn btn-secondary w-full justify-center text-[10px]">
            <Radar className="w-3.5 h-3.5" /> Apply Unit Position
          </button>
        </div>

        <div className="rounded-md border border-white/10 bg-bg-tertiary p-2.5 space-y-2">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-400">
            <Route className="w-3.5 h-3.5 text-accent-amber" />
            <span>Waypoint Coordinates</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[9px] text-slate-500 uppercase tracking-wider mb-1">Latitude</label>
              <input value={waypointDraft.lat} onChange={(e) => setWaypointDraft((prev) => ({ ...prev, lat: Number(e.target.value) }))} className="input text-xs" />
            </div>
            <div>
              <label className="block text-[9px] text-slate-500 uppercase tracking-wider mb-1">Longitude</label>
              <input value={waypointDraft.lng} onChange={(e) => setWaypointDraft((prev) => ({ ...prev, lng: Number(e.target.value) }))} className="input text-xs" />
            </div>
            <div className="col-span-2">
              <label className="block text-[9px] text-slate-500 uppercase tracking-wider mb-1">Altitude (m)</label>
              <input value={waypointDraft.altitude} onChange={(e) => setWaypointDraft((prev) => ({ ...prev, altitude: Number(e.target.value) }))} className="input text-xs" type="number" />
            </div>
          </div>
          <button onClick={handleAddWaypointFromCoords} disabled={readOnly || missionActive} className="btn btn-primary w-full justify-center text-[10px]">
            <MapPin className="w-3.5 h-3.5" /> Add Waypoint by Coordinates
          </button>
        </div>

        <div className="rounded-md border border-white/10 bg-bg-tertiary p-2.5 space-y-2">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-400">
            <Crosshair className="w-3.5 h-3.5 text-accent-blue" />
            <span>Auto-generate mission</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[9px] text-slate-500 uppercase tracking-wider mb-1">Latitude</label>
              <input value={targetDraft.lat} onChange={(e) => setTargetDraft((prev) => ({ ...prev, lat: Number(e.target.value) }))} className="input text-xs" />
            </div>
            <div>
              <label className="block text-[9px] text-slate-500 uppercase tracking-wider mb-1">Longitude</label>
              <input value={targetDraft.lng} onChange={(e) => setTargetDraft((prev) => ({ ...prev, lng: Number(e.target.value) }))} className="input text-xs" />
            </div>
            <div className="col-span-2">
              <label className="block text-[9px] text-slate-500 uppercase tracking-wider mb-1">Target altitude (m)</label>
              <input value={targetDraft.altitude} onChange={(e) => setTargetDraft((prev) => ({ ...prev, altitude: Number(e.target.value) }))} className="input text-xs" type="number" />
            </div>
          </div>
          <button onClick={autoGenerateMissionFromTarget} disabled={readOnly || missionActive} className="btn btn-primary w-full justify-center text-[10px]">
            <Radar className="w-3.5 h-3.5" /> Generate mission from target
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] text-slate-500 uppercase tracking-wider">Waypoints</label>
            {waypoints.length > 0 && !missionActive && !readOnly && (
              <button onClick={clearWaypoints} className="text-[10px] text-slate-500 hover:text-accent-red transition-colors flex items-center gap-1">
                <Trash2 className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin">
            {waypoints.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-4 text-slate-600">
                <MapPin className="w-6 h-6 mb-1 opacity-30" />
                <p className="text-[10px]">{planningMode ? 'Click map to add waypoints' : 'Enable planning mode'}</p>
              </div>
            ) : (
              waypoints.map((wp, i) => (
                <div key={i} className="flex items-center justify-between bg-bg-tertiary rounded-md px-2.5 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-accent-amber/20 text-accent-amber flex items-center justify-center text-[9px] font-mono font-bold">{i + 1}</span>
                    <span className="text-xs font-mono text-slate-300">{wp.label}</span>
                    <span className="text-[10px] font-mono text-slate-600">{wp.x.toFixed(0)}, {wp.y.toFixed(0)}</span>
                  </div>
                  {!missionActive && !readOnly && (
                    <button onClick={() => removeWaypoint(i)} className="text-slate-600 hover:text-accent-red transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pt-2 border-t border-white/5">
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <ShieldIcon />
            <span>Geofence: {geofence.length} vertices defined</span>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 p-3 space-y-2">
        {!missionActive && !missionPaused && !missionComplete && (
          <button onClick={onStart} disabled={!canStart} className="btn btn-primary w-full justify-center">
            <Play className="w-3.5 h-3.5" /> Start Mission
          </button>
        )}
        {missionActive && !missionPaused && !missionComplete && (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={onPause} disabled={readOnly} className="btn btn-secondary justify-center">
              <Pause className="w-3.5 h-3.5" /> Pause
            </button>
            <button onClick={onAbort} disabled={readOnly} className="btn btn-danger justify-center">
              <OctagonX className="w-3.5 h-3.5" /> Abort
            </button>
          </div>
        )}
        {missionPaused && !missionComplete && (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={onResume} disabled={readOnly} className="btn btn-teal justify-center">
              <Play className="w-3.5 h-3.5" /> Resume
            </button>
            <button onClick={onAbort} disabled={readOnly} className="btn btn-danger justify-center">
              <OctagonX className="w-3.5 h-3.5" /> Abort
            </button>
          </div>
        )}
        {missionActive && !missionComplete && (
          <button onClick={onReturnToBase} disabled={readOnly} className="btn btn-secondary w-full justify-center">
            <Home className="w-3.5 h-3.5" /> Return to Base
          </button>
        )}
        {missionComplete && (
          <div className="rounded-md border border-accent-green/30 bg-accent-green/10 px-3 py-2 text-center text-[10px] font-mono font-semibold tracking-wider text-accent-green">
            MISSION COMPLETE — UNIT HOLDING POSITION
          </div>
        )}
        {selectedUnit === 'MEDDROP' && payload && !missionActive && (
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <Package className="w-3 h-3 text-accent-amber" />
            <span>Payload: {payload}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg className="w-3 h-3 text-accent-amber/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2L4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" />
    </svg>
  );
}

function StatusMetric({ label, value, tone }: { label: string; value: string; tone: 'amber' | 'cyan' | 'green' | 'slate' }) {
  const colors = { amber: 'text-accent-amber', cyan: 'text-accent-blue', green: 'text-accent-green', slate: 'text-slate-300' };
  return (
    <div className="rounded-md bg-bg-tertiary px-2 py-2 min-w-0">
      <div className="text-[8px] text-slate-600 uppercase tracking-wider truncate">{label}</div>
      <div className={`mt-1 text-[10px] font-mono font-semibold truncate ${colors[tone]}`}>{value}</div>
    </div>
  );
}

function TelemetryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-accent-blue/10 bg-accent-blue/5 px-2 py-1.5 text-center">
      <div className="text-[8px] text-slate-600 uppercase tracking-wider">{label}</div>
      <div className="text-[11px] font-mono font-semibold text-accent-blue">{value}</div>
    </div>
  );
}

function DroneIcon({ active }: { active: boolean }) {
  const color = active ? '#f59e0b' : '#64748b';
  return (
    <svg viewBox="0 0 64 40" className="w-14 h-9" fill="none" stroke={color} strokeWidth="2">
      <path d="M22 20h20M32 16v8M26 20l-8-8M38 20l8-8M26 20l-8 8M38 20l8 8" />
      <circle cx="16" cy="10" r="4" /><circle cx="48" cy="10" r="4" /><circle cx="16" cy="30" r="4" /><circle cx="48" cy="30" r="4" />
      <rect x="26" y="15" width="12" height="10" rx="3" fill={`${color}30`} />
      <path d="M30 25v4h4v-4" />
    </svg>
  );
}

function MedicalDroneIcon({ active }: { active: boolean }) {
  const color = active ? '#f59e0b' : '#64748b';
  return (
    <svg viewBox="0 0 64 40" className="w-14 h-9" fill="none" stroke={color} strokeWidth="2">
      <path d="M22 20h20M32 16v8M26 20l-8-8M38 20l8-8M26 20l-8 8M38 20l8 8" />
      <circle cx="16" cy="10" r="4" /><circle cx="48" cy="10" r="4" /><circle cx="16" cy="30" r="4" /><circle cx="48" cy="30" r="4" />
      <rect x="25" y="14" width="14" height="12" rx="3" fill={`${color}30`} />
      <path d="M32 16v8M28 20h8" stroke="#ef4444" />
    </svg>
  );
}

function RoverIcon({ active }: { active: boolean }) {
  const color = active ? '#f59e0b' : '#64748b';
  return (
    <svg viewBox="0 0 64 40" className="w-14 h-9" fill="none" stroke={color} strokeWidth="2">
      <circle cx="17" cy="30" r="5" fill={`${color}30`} /><circle cx="47" cy="30" r="5" fill={`${color}30`} />
      <path d="M12 27l5-12h23l12 12H12z" fill={`${color}20`} />
      <path d="M27 15l3-7h8l4 7M34 8v7M23 20h18" />
      <circle cx="34" cy="20" r="3" />
    </svg>
  );
}

export { MissionPlanner as default };
