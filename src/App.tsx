import { useState, useEffect, useRef, useCallback } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AuthScreen } from '@/components/AuthScreen';
import { Sidebar, type ViewId } from '@/components/Sidebar';
import { HeaderBar } from '@/components/HeaderBar';
import { TacticalMap } from '@/components/TacticalMap';
import { VehiclePanel } from '@/components/VehiclePanel';
import { AlertFeed } from '@/components/AlertFeed';
import { MissionPlanner } from '@/components/MissionPlanner';
import { SurvivorRegistry } from '@/components/SurvivorRegistry';
import { SLAMMap } from '@/components/SLAMMap';
import { MissionLog } from '@/components/MissionLog';
import { OverviewPage } from '@/components/OverviewPage';
import { AnalyticsPage } from '@/components/AnalyticsPage';
import { SettingsPage } from '@/components/SettingsPage';
import { simulation } from '@/lib/simulation';
import { supabase } from '@/lib/supabase';
import { UNIT_IDS, defaultGeofence, UNIT_CONFIG, latLngToMap, generateWaypointLabel } from '@/lib/constants';
import type {
  UnitTelemetry,
  Survivor,
  Alert,
  MissionEvent,
  Mission,
  Waypoint,
  GeofencePoint,
  UnitId,
  OccupancyMap,
  ScoutSurvivorDetection,
  RoverVerificationMission,
  SupplyMission,
} from '@/types';

const VIEW_TITLES: Record<ViewId, string> = {
  overview: 'Command Brief',
  operations: 'Live Operations',
  vehicles: 'Vehicle Panel',
  planner: 'Mission Planner',
  survivors: 'Survivor Registry',
  mapping: 'SLAM Mapping View',
  analytics: 'Mission Analytics',
  logs: 'Mission Log & Reports',
  settings: 'System Settings',
};

function Dashboard() {
  const { role, signOut, session } = useAuth();
  const readOnly = role === 'observer';

  const [activeView, setActiveView] = useState<ViewId>('overview');
  const [telemetry, setTelemetry] = useState<UnitTelemetry[]>([]);
  const [survivors, setSurvivors] = useState<Survivor[]>([]);
  const [scoutDetections, setScoutDetections] = useState<ScoutSurvivorDetection[]>([]);
  const [roverVerificationMission, setRoverVerificationMission] = useState<RoverVerificationMission | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [events, setEvents] = useState<MissionEvent[]>([]);
  const [slamMap, setSlamMap] = useState<OccupancyMap>({ grid: new Uint8Array(50 * 35), width: 50, height: 35, cellSize: 20 });

  // Mission planning state
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [geofence, setGeofence] = useState<GeofencePoint[]>(defaultGeofence());
  const [geofenceEditing, setGeofenceEditing] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<UnitId>('RECON');
  const [missionName, setMissionName] = useState('Operation Phoenix');
  const [payload, setPayload] = useState('');
  const [missionMode, setMissionMode] = useState<Mission['mode']>('AUTONOMOUS');
  const [missionActive, setMissionActive] = useState(false);
  const [missionPaused, setMissionPaused] = useState(false);
  const [hasActiveMission, setHasActiveMission] = useState(false);
  const [activeMissionUnit, setActiveMissionUnit] = useState<UnitId | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const activeMissionRef = useRef<Mission | null>(null);

  // Telemetry polling
  useEffect(() => {
    const id = setInterval(() => {
      setTelemetry([...simulation.getTelemetry()]);
      setSlamMap(simulation.getSLAMMap());
      setElapsed(simulation.getElapsed());
    }, 500);
    return () => clearInterval(id);
  }, []);

  // Simulation callbacks
  useEffect(() => {
    simulation.onAlert(async (alert) => {
      const alertRecord: Alert = {
        ...alert,
        id: crypto.randomUUID(),
        acknowledged: false,
        created_at: new Date().toISOString(),
      };
      setAlerts((prev) => [alertRecord, ...prev].slice(0, 50));

      // Insert into DB
      try {
        await supabase.from('alerts').insert({
          mission_id: alert.mission_id,
          unit_id: alert.unit_id,
          type: alert.type,
          severity: alert.severity,
          message: alert.message,
        });
      } catch {
        // ignore DB errors in simulation
      }
    });

    simulation.onSurvivor(async (survivor) => {
      const survivorRecord: Survivor = {
        ...survivor,
        id: crypto.randomUUID(),
        created_by: '',
        created_at: new Date().toISOString(),
      };
      setSurvivors((prev) => [...prev, survivorRecord]);

      const detectionRecord: ScoutSurvivorDetection = {
        detectionId: crypto.randomUUID(),
        sourceUnit: 'SCOUT_S1',
        latitude: survivor.lat,
        longitude: survivor.lng,
        altitude: 45,
        confidence: survivor.confidence,
        detectedAt: survivor.detected_at,
        status: 'DETECTED',
      };
      setScoutDetections((prev) => [detectionRecord, ...prev].slice(0, 50));

      setEvents((prev) => [{
        id: crypto.randomUUID(),
        mission_id: activeMissionRef.current?.id ?? null,
        unit_id: 'SCOUT_S1',
        type: 'survivor' as MissionEvent['type'],
        message: `Mission Hub received survivor detection from ${survivor.detected_by} at ${survivor.lat.toFixed(5)}, ${survivor.lng.toFixed(5)}`,
        data: {
          survivorId: survivor.survivor_id,
          latitude: survivor.lat,
          longitude: survivor.lng,
          confidence: survivor.confidence,
          sourceUnit: survivor.detected_by,
        },
        created_at: new Date().toISOString(),
      } as MissionEvent, ...prev].slice(0, 200));

      try {
        await supabase.from('survivors').insert({
          mission_id: survivor.mission_id,
          created_by: session?.user.id ?? null,
          survivor_id: survivor.survivor_id,
          lat: survivor.lat,
          lng: survivor.lng,
          detected_by: survivor.detected_by,
          confidence: survivor.confidence,
          severity: survivor.severity,
          medicine_dispatched: survivor.medicine_dispatched,
          status: survivor.status,
          detected_at: survivor.detected_at,
        });
      } catch {
        // ignore
      }
    });

    simulation.onEvent(async (event) => {
      const eventRecord: MissionEvent = {
        id: crypto.randomUUID(),
        mission_id: activeMissionRef.current?.id ?? null,
        unit_id: event.unit_id,
        type: event.type as MissionEvent['type'],
        message: event.message,
        data: event.data ?? null,
        created_at: new Date().toISOString(),
      };
      setEvents((prev) => [eventRecord, ...prev].slice(0, 200));

      try {
        await supabase.from('events').insert({
          mission_id: activeMissionRef.current?.id ?? null,
          unit_id: event.unit_id,
          type: event.type,
          message: event.message,
          data: event.data ?? null,
        });
      } catch {
        // ignore
      }
    });

    simulation.onVerificationResult((result) => {
      const verificationStatus = result.verificationStatus;
      const verifiedAt = result.verifiedAt;

      setScoutDetections((prev) => prev.map((item) => {
        if (item.detectionId !== result.detectionId) return item;
        return {
          ...item,
          status: verificationStatus === 'VERIFIED' ? 'VERIFIED' : 'REJECTED',
          verifiedBy: result.verifiedBy,
          verifiedAt,
          verificationStatus,
        };
      }));

      setSurvivors((prev) => {
        const matched = prev.find((item) => Math.abs(item.lat - result.latitude) < 0.00005 && Math.abs(item.lng - result.longitude) < 0.00005);

        if (verificationStatus === 'VERIFIED' && matched) {
          const mission: SupplyMission = {
            missionId: `SUP-${matched.survivor_id}`,
            survivorId: matched.survivor_id,
            detectionId: result.detectionId,
            assignedUnit: 'MEDDROP',
            latitude: result.latitude,
            longitude: result.longitude,
            altitude: result.altitude,
            payload: 'Emergency Medical Kit',
            missionMode: 'AUTONOMOUS',
            missionStatus: 'READY',
            createdAt: new Date().toISOString(),
          };
          simulation.assignSupplyMission(mission);
          setEvents((prevEvents) => [{
            id: crypto.randomUUID(),
            mission_id: activeMissionRef.current?.id ?? null,
            unit_id: 'MEDDROP',
            type: 'mission' as MissionEvent['type'],
            message: `Mission Hub created Supply UAV mission for ${matched.survivor_id} after rover verification`,
            data: {
              missionId: mission.missionId,
              survivorId: mission.survivorId,
              detectionId: mission.detectionId,
              assignedUnit: mission.assignedUnit,
              latitude: mission.latitude,
              longitude: mission.longitude,
              altitude: mission.altitude,
              payload: mission.payload,
              missionMode: mission.missionMode,
              missionStatus: mission.missionStatus,
            },
            created_at: new Date().toISOString(),
          } as MissionEvent, ...prevEvents].slice(0, 200));
        }

        return prev.map((item) => {
          const sameTarget = Math.abs(item.lat - result.latitude) < 0.00005 && Math.abs(item.lng - result.longitude) < 0.00005;
          if (!sameTarget) return item;

          return {
            ...item,
            detectionState: verificationStatus === 'VERIFIED' ? 'VERIFIED' : 'REJECTED',
            roverState: verificationStatus === 'VERIFIED' ? 'VERIFIED' : 'STANDBY',
            supplyUavState: verificationStatus === 'VERIFIED' ? 'READY' : 'STANDBY',
            verificationStatus,
            verifiedBy: result.verifiedBy,
            verifiedAt,
            status: verificationStatus === 'VERIFIED' ? 'verified' : item.status,
          };
        });
      });

      setEvents((prev) => [{
        id: crypto.randomUUID(),
        mission_id: activeMissionRef.current?.id ?? null,
        unit_id: 'ROVER_R1',
        type: 'verification' as MissionEvent['type'],
        message: verificationStatus === 'VERIFIED'
          ? `Survivor confirmed at ${result.latitude.toFixed(5)}, ${result.longitude.toFixed(5)}`
          : `No survivor confirmed at ${result.latitude.toFixed(5)}, ${result.longitude.toFixed(5)}`,
        data: {
          detectionId: result.detectionId,
          verificationStatus,
          verifiedBy: result.verifiedBy,
          verifiedAt,
          latitude: result.latitude,
          longitude: result.longitude,
          altitude: result.altitude,
        },
        created_at: new Date().toISOString(),
      } as MissionEvent, ...prev].slice(0, 200));
    });
  }, [session?.user.id]);

  // Load existing data from DB on mount
  useEffect(() => {
    (async () => {
      try {
        const [{ data: dbSurvivors }, { data: dbAlerts }, { data: dbEvents }] = await Promise.all([
          supabase.from('survivors').select('*').order('detected_at', { ascending: false }).limit(50),
          supabase.from('alerts').select('*').order('created_at', { ascending: false }).limit(50),
          supabase.from('events').select('*').order('created_at', { ascending: false }).limit(200),
        ]);

        if (dbSurvivors) setSurvivors(dbSurvivors as Survivor[]);
        if (dbAlerts) setAlerts(dbAlerts as Alert[]);
        if (dbEvents) setEvents(dbEvents as MissionEvent[]);
      } catch {
        // ignore
      }
    })();
  }, []);

  const unackAlertCount = alerts.filter((a) => !a.acknowledged).length;
  const obstacles = simulation.getObstacles();
  const roverUnit = telemetry.find((t) => t.unitId === 'ROVER_R1');
  const selectedTelemetry = telemetry.find((t) => t.unitId === selectedUnit);

  const validateSupplyMissionBeforeDispatch = useCallback(() => {
    if (selectedUnit !== 'MEDDROP') {
      return { valid: true, reasons: [] as string[] };
    }

    const target = waypoints[waypoints.length - 1] ?? waypoints[0];
    const latitude = Number(target?.latitude ?? selectedTelemetry?.gpsLat ?? 0);
    const longitude = Number(target?.longitude ?? selectedTelemetry?.gpsLng ?? 0);
    const altitude = Number(target?.altitude ?? selectedTelemetry?.altitude ?? 0);
    const latOk = Number.isFinite(latitude) && Math.abs(latitude) <= 90;
    const lngOk = Number.isFinite(longitude) && Math.abs(longitude) <= 180;
    const altOk = Number.isFinite(altitude) && altitude > 0 && altitude <= 3000;
    const routeExists = waypoints.length >= 2;
    const batteryValue = selectedTelemetry?.battery ?? 0;
    const batteryOk = batteryValue >= 25;

    const geofencePoints = geofence.length >= 3 ? geofence : defaultGeofence();
    const geofenceOk = (() => {
      if (geofencePoints.length < 3 || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
      const targetPoint = latLngToMap(latitude, longitude);
      let inside = false;
      for (let i = 0, j = geofencePoints.length - 1; i < geofencePoints.length; j = i++) {
        const xi = geofencePoints[i].x;
        const yi = geofencePoints[i].y;
        const xj = geofencePoints[j].x;
        const yj = geofencePoints[j].y;
        const intersect = ((yi > targetPoint.y) !== (yj > targetPoint.y)) &&
          (targetPoint.x < ((xj - xi) * (targetPoint.y - yi)) / (yj - yi + Number.EPSILON) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    })();

    const reasons: string[] = [];
    if (!latOk) reasons.push('Latitude invalid');
    if (!lngOk) reasons.push('Longitude invalid');
    if (!altOk) reasons.push('Altitude invalid');
    if (!routeExists) reasons.push('Route missing');
    if (!geofenceOk) reasons.push('Target outside geofence');
    if (!batteryOk) reasons.push('Supply UAV battery below threshold');
    if (selectedUnit !== 'MEDDROP') reasons.push('Supply UAV unavailable');

    return {
      valid: reasons.length === 0,
      reasons,
    };
  }, [selectedUnit, waypoints, geofence, selectedTelemetry]);

  const handleStartMission = useCallback(async () => {
    const validation = validateSupplyMissionBeforeDispatch();
    if (!validation.valid) {
      setAlerts((prev) => [{
        id: crypto.randomUUID(),
        mission_id: activeMissionRef.current?.id ?? null,
        unit_id: selectedUnit,
        type: 'system' as Alert['type'],
        severity: 'warning' as Alert['severity'],
        message: `MISSION BLOCKED — ${validation.reasons[0]}`,
        acknowledged: false,
        created_at: new Date().toISOString(),
      } as Alert, ...prev].slice(0, 50));
      return;
    }

    if (readOnly || waypoints.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('missions')
        .insert({
          name: missionName,
          description: 'SAR mission — SIH simulation',
          unit_id: selectedUnit,
          created_by: session?.user.id ?? null,
          payload: payload || null,
          mode: missionMode,
          waypoints: waypoints,
          geofence,
          status: 'active',
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      const mission = data as unknown as Mission;
      activeMissionRef.current = mission;
      setMissionActive(true);
      setMissionPaused(false);
      setHasActiveMission(true);
      setActiveMissionUnit(selectedUnit);
      simulation.start({ ...mission, mode: missionMode });
    } catch {
      // Fallback: start without DB
      const mission: Mission = {
        id: crypto.randomUUID(),
        name: missionName,
        description: null,
        unit_id: selectedUnit,
        payload: payload || null,
        waypoints,
        geofence,
        mode: missionMode,
        status: 'active',
        created_by: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        completed_at: null,
      };
      activeMissionRef.current = mission;
      setMissionActive(true);
      setHasActiveMission(true);
      setActiveMissionUnit(selectedUnit);
      simulation.start(mission);
    }
  }, [readOnly, waypoints, missionName, selectedUnit, payload, missionMode, session?.user.id, geofence, validateSupplyMissionBeforeDispatch]);

  const handlePause = useCallback(() => {
    if (readOnly) return;
    simulation.pause();
    setMissionPaused(true);
  }, [readOnly]);

  const handleResume = useCallback(() => {
    if (readOnly) return;
    simulation.resume();
    setMissionPaused(false);
  }, [readOnly]);

  const handleAbort = useCallback(async () => {
    if (readOnly) return;
    simulation.abort();
    setMissionActive(false);
    setMissionPaused(false);
    setHasActiveMission(false);
    setActiveMissionUnit(null);

    if (activeMissionRef.current) {
      try {
        await supabase
          .from('missions')
          .update({ status: 'aborted', completed_at: new Date().toISOString() })
          .eq('id', activeMissionRef.current.id);
      } catch {
        // ignore
      }
    }
    activeMissionRef.current = null;
  }, [readOnly]);

  const handleReturnToBase = useCallback(() => {
    if (readOnly) return;
    simulation.returnToBase();
  }, [readOnly]);

  const handleAcknowledgeAlert = useCallback(async (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)));
    try {
      await supabase.from('alerts').update({ acknowledged: true }).eq('id', id);
    } catch {
      // ignore
    }
  }, []);

  const handleUpdateSurvivorStatus = useCallback(async (id: string, status: string) => {
    setSurvivors((prev) => prev.map((s) => (s.id === id ? { ...s, status: status as Survivor['status'] } : s)));
    try {
      await supabase.from('survivors').update({ status }).eq('id', id);
    } catch {
      // ignore
    }
  }, []);

  const handleDispatchMedicine = useCallback(async (id: string) => {
    setSurvivors((prev) =>
      prev.map((s) => (s.id === id ? { ...s, medicine_dispatched: true, status: 'aided' } : s))
    );
    try {
      await supabase.from('survivors').update({ medicine_dispatched: true, status: 'aided' }).eq('id', id);
    } catch {
      // ignore
    }
    const survivor = survivors.find((s) => s.id === id);
    if (survivor) {
      setEvents((prev) => [
        {
          id: crypto.randomUUID(),
          mission_id: activeMissionRef.current?.id ?? null,
          unit_id: 'MEDDROP',
          type: 'survivor' as MissionEvent['type'],
          message: `Medicine dispatched to ${survivor.survivor_id}`,
          data: null,
          created_at: new Date().toISOString(),
        } as MissionEvent,
        ...prev,
      ]);
    }
  }, [survivors]);

  const handleVerifyWithRover = useCallback((detection: ScoutSurvivorDetection) => {
    const mission: RoverVerificationMission = {
      missionId: `VER-${detection.detectionId}`,
      targetDetectionId: detection.detectionId,
      assignedUnit: 'ROVER_R1',
      targetLatitude: detection.latitude,
      targetLongitude: detection.longitude,
      targetAltitude: detection.altitude,
      missionMode: 'AUTONOMOUS',
      missionStatus: 'VERIFYING',
      createdAt: new Date().toISOString(),
    };

    setRoverVerificationMission(mission);
    setScoutDetections((prev) => prev.map((item) => item.detectionId === detection.detectionId ? { ...item, status: 'VERIFYING' } : item));
    setSurvivors((prev) => prev.map((item) => {
      const sameTarget = Math.abs(item.lat - detection.latitude) < 0.00005 && Math.abs(item.lng - detection.longitude) < 0.00005;
      return sameTarget ? { ...item, detectionState: 'VERIFYING', roverState: 'VERIFYING', supplyUavState: 'STANDBY' } : item;
    }));

    simulation.assignRoverVerificationMission(mission);

    setEvents((prev) => [{
      id: crypto.randomUUID(),
      mission_id: activeMissionRef.current?.id ?? null,
      unit_id: 'ROVER_R1' as UnitId,
      type: 'mission' as MissionEvent['type'],
      message: `Rover verification mission created for ${detection.detectionId}`,
      data: {
        missionId: mission.missionId,
        targetDetectionId: mission.targetDetectionId,
        assignedUnit: mission.assignedUnit,
        targetLatitude: mission.targetLatitude,
        targetLongitude: mission.targetLongitude,
        targetAltitude: mission.targetAltitude,
        missionMode: mission.missionMode,
        missionStatus: mission.missionStatus,
      },
      created_at: new Date().toISOString(),
    } as MissionEvent, ...prev].slice(0, 200));
  }, []);

  const handleExportAAR = useCallback(() => {
    const mission = activeMissionRef.current;
    const report = {
      afterActionReport: true,
      missionName: mission?.name || 'Untitled',
      generatedAt: new Date().toISOString(),
      duration: formatDuration(simulation.getElapsed()),
      units: UNIT_IDS.map((id) => {
        const t = simulation.getUnit(id);
        return {
          callsign: UNIT_CONFIG[id].callsign,
          name: UNIT_CONFIG[id].name,
          finalBattery: t?.battery.toFixed(1) + '%',
          finalPosition: t ? `${t.x.toFixed(0)}, ${t.y.toFixed(0)}` : 'N/A',
          status: t?.status || 'Unknown',
        };
      }),
      survivorsDetected: survivors.length,
      survivorsByStatus: {
        reported: survivors.filter((s) => s.status === 'reported').length,
        verified: survivors.filter((s) => s.status === 'verified').length,
        aided: survivors.filter((s) => s.status === 'aided').length,
        rescued: survivors.filter((s) => s.status === 'rescued').length,
      },
      medicineDispatched: survivors.filter((s) => s.medicine_dispatched).length,
      totalAlerts: alerts.length,
      criticalAlerts: alerts.filter((a) => a.severity === 'critical').length,
      eventLog: events.map((e) => ({
        time: e.created_at,
        unit: e.unit_id,
        type: e.type,
        message: e.message,
      })),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AAR_${mission?.name?.replace(/\s+/g, '_') || 'mission'}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [survivors, alerts, events]);

  const handleAddWaypoint = useCallback((latitude: number, longitude: number, altitude = 30) => {
    const point = latLngToMap(latitude, longitude);
    const wp: Waypoint = {
      x: point.x,
      y: point.y,
      label: `WP-${String(waypoints.length + 1).padStart(2, '0')}`,
      latitude,
      longitude,
      altitude,
    };
    setWaypoints((prev) => [...prev, { ...wp, label: generateWaypointLabel(prev.length) }]);
  }, [waypoints.length]);

  const handleAddWaypointFromCoords = useCallback((latitude: number, longitude: number, altitude: number) => {
    const point = latLngToMap(latitude, longitude);
    const wp: Waypoint = {
      x: point.x,
      y: point.y,
      label: generateWaypointLabel(waypoints.length),
      latitude,
      longitude,
      altitude,
    };
    setWaypoints((prev) => [...prev, { ...wp, label: generateWaypointLabel(prev.length) }]);
  }, [waypoints.length]);

  const handleApplyUnitPosition = useCallback((unitId: UnitId, latitude: number, longitude: number, altitude: number) => {
    simulation.setUnitPosition(unitId, latitude, longitude, altitude);
    setTelemetry([...simulation.getTelemetry()]);
  }, []);

  const handleRemoveWaypoint = useCallback((index: number) => {
    setWaypoints((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((wp, i) => ({ ...wp, label: `WP-${String(i + 1).padStart(2, '0')}` }));
    });
  }, []);

  const missionComplete = Boolean(
    activeMissionUnit &&
      missionActive &&
      selectedTelemetry &&
      selectedTelemetry.currentWaypoint >= waypoints.length &&
      waypoints.length > 0 &&
      selectedTelemetry.status === 'Idle'
  );

  return (
    <div className="h-screen flex bg-bg-primary">
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        role={role}
        onSignOut={signOut}
        missionActive={missionActive}
        alertCount={unackAlertCount}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <HeaderBar
          viewTitle={VIEW_TITLES[activeView]}
          missionActive={missionActive}
          missionPaused={missionPaused}
          elapsed={elapsed}
          unitCount={UNIT_IDS.length}
          survivorCount={survivors.length}
          alertCount={unackAlertCount}
        />

        <div className="flex-1 overflow-hidden p-3">
          {activeView === 'operations' && (
            <div className="h-full grid grid-cols-12 gap-3">
              {/* Map - large center */}
              <div className="col-span-8 panel p-0 overflow-hidden relative">
                <TacticalMap
                  telemetry={telemetry}
                  survivors={survivors}
                  scoutDetections={scoutDetections}
                  roverVerificationMission={roverVerificationMission}
                  onVerifyWithRover={handleVerifyWithRover}
                  waypoints={waypoints}
                  geofence={geofence}
                  obstacles={obstacles}
                  missionActive={missionActive}
                  planningMode={false}
                  onWaypointAdd={undefined}
                  selectedUnit={selectedUnit}
                  elapsed={elapsed}
                />
                {/* Map overlay info */}
                <div className="absolute top-3 right-3 panel px-3 py-1.5 text-[10px] text-slate-400 font-mono">
                  SCALE 1:500 | GRID 50m
                </div>
                <div className="absolute bottom-3 left-3 panel px-3 py-1.5 flex items-center gap-3 text-[10px]">
                  {UNIT_IDS.map((id) => {
                    const cfg = UNIT_CONFIG[id];
                    return (
                      <div key={id} className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
                        <span className="text-slate-400 font-mono">{cfg.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right column: alerts */}
              <div className="col-span-4 flex flex-col gap-3 h-full">
                <div className="flex-1 min-h-0">
                  <AlertFeed alerts={alerts} onAcknowledge={handleAcknowledgeAlert} readOnly={readOnly} />
                </div>
              </div>

              {/* Bottom strip: vehicle cards */}
              <div className="col-span-12 h-48">
                <div className="h-full">
                  <VehiclePanel
                    telemetry={telemetry}
                    selectedUnit={selectedUnit}
                    onSelectUnit={setSelectedUnit}
                    missionActive={missionActive}
                  />
                </div>
              </div>
            </div>
          )}

          {activeView === 'overview' && (
            <OverviewPage
              telemetry={telemetry}
              survivors={survivors}
              alerts={alerts}
              events={events}
              missionActive={missionActive}
              missionPaused={missionPaused}
              elapsed={elapsed}
              onOpenView={setActiveView}
            />
          )}

          {activeView === 'vehicles' && (
            <div className="h-full grid grid-cols-3 gap-3">
              {telemetry.map((t) => (
                <div key={t.unitId} className="h-full">
                  <VehiclePanel
                    telemetry={[t]}
                    selectedUnit={selectedUnit}
                    onSelectUnit={setSelectedUnit}
                    missionActive={missionActive}
                  />
                </div>
              ))}
            </div>
          )}

          {activeView === 'planner' && (
            <div className="h-full min-h-0 overflow-y-auto scrollbar-thin grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="h-[58vh] min-h-[420px] lg:h-full lg:col-span-8 min-h-0 panel p-0 overflow-hidden relative">
                <TacticalMap
                  telemetry={telemetry}
                  survivors={survivors}
                  scoutDetections={scoutDetections}
                  waypoints={waypoints}
                  geofence={geofence}
                  obstacles={obstacles}
                  missionActive={missionActive}
                  planningMode={!missionActive && !readOnly}
                  onWaypointAdd={handleAddWaypoint}
                  onWaypointRemove={handleRemoveWaypoint}
                  onGeofenceChange={setGeofence}
                  geofenceEditing={geofenceEditing}
                  selectedUnit={selectedUnit}
                  elapsed={elapsed}
                />
              </div>
              <div className="lg:col-span-4 h-auto lg:h-full min-h-0">
                <MissionPlanner
                  waypoints={waypoints}
                  onWaypointsChange={setWaypoints}
                  survivors={survivors}
                  geofence={geofence}
                  onGeofenceChange={setGeofence}
                  geofenceEditing={geofenceEditing}
                  onGeofenceEditingChange={setGeofenceEditing}
                  selectedUnit={selectedUnit}
                  onUnitChange={setSelectedUnit}
                  missionName={missionName}
                  onMissionNameChange={setMissionName}
                  payload={payload}
                  onPayloadChange={setPayload}
                  missionMode={missionMode}
                  onMissionModeChange={setMissionMode}
                  missionActive={missionActive}
                  missionPaused={missionPaused}
                  onStart={handleStartMission}
                  onPause={handlePause}
                  onResume={handleResume}
                  onAbort={handleAbort}
                  onReturnToBase={handleReturnToBase}
                  readOnly={readOnly}
                  hasActiveMission={hasActiveMission}
                  selectedTelemetry={selectedTelemetry}
                  missionComplete={missionComplete}
                  onApplyUnitPosition={handleApplyUnitPosition}
                  onAddWaypointFromCoords={handleAddWaypointFromCoords}
                />
              </div>
            </div>
          )}

          {activeView === 'survivors' && (
            <div className="h-full">
              <SurvivorRegistry
                survivors={survivors}
                onUpdateStatus={handleUpdateSurvivorStatus}
                onDispatchMedicine={handleDispatchMedicine}
                readOnly={readOnly}
              />
            </div>
          )}

          {activeView === 'mapping' && (
            <div className="h-full">
              <SLAMMap
                map={slamMap}
                roverX={roverUnit?.x ?? 150}
                roverY={roverUnit?.y ?? 580}
                obstacles={obstacles}
              />
            </div>
          )}

          {activeView === 'analytics' && (
            <AnalyticsPage
              telemetry={telemetry}
              survivors={survivors}
              alerts={alerts}
              elapsed={elapsed}
              onExport={handleExportAAR}
            />
          )}

          {activeView === 'logs' && (
            <div className="h-full">
              <MissionLog events={events} onExport={handleExportAAR} readOnly={readOnly} />
            </div>
          )}

          {activeView === 'settings' && <SettingsPage role={role} />}

        </div>
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="text-slate-500 text-sm font-mono">INITIALIZING SYSTEM...</div>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return <Dashboard />;
}

export default function AppWithAuth() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}
