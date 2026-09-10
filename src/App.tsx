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
import { simulation } from '@/lib/simulation';
import { supabase } from '@/lib/supabase';
import { UNIT_IDS, defaultGeofence, UNIT_CONFIG } from '@/lib/constants';
import type {
  UnitTelemetry,
  Survivor,
  Alert,
  MissionEvent,
  Mission,
  Waypoint,
  UnitId,
  OccupancyMap,
} from '@/types';

const VIEW_TITLES: Record<ViewId, string> = {
  operations: 'Live Operations',
  vehicles: 'Vehicle Panel',
  planner: 'Mission Planner',
  survivors: 'Survivor Registry',
  mapping: 'SLAM Mapping View',
  logs: 'Mission Log & Reports',
};

function Dashboard() {
  const { role, signOut } = useAuth();
  const readOnly = role === 'observer';

  const [activeView, setActiveView] = useState<ViewId>('operations');
  const [telemetry, setTelemetry] = useState<UnitTelemetry[]>([]);
  const [survivors, setSurvivors] = useState<Survivor[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [events, setEvents] = useState<MissionEvent[]>([]);
  const [slamMap, setSlamMap] = useState<OccupancyMap>({ grid: new Uint8Array(50 * 35), width: 50, height: 35, cellSize: 20 });

  // Mission planning state
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<UnitId>('RECON');
  const [missionName, setMissionName] = useState('Operation Phoenix');
  const [payload, setPayload] = useState('');
  const [missionActive, setMissionActive] = useState(false);
  const [missionPaused, setMissionPaused] = useState(false);
  const [hasActiveMission, setHasActiveMission] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [planningMode, setPlanningMode] = useState(false);

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

      try {
        await supabase.from('survivors').insert({
          mission_id: survivor.mission_id,
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
  }, []);

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

  const handleStartMission = useCallback(async () => {
    if (readOnly || waypoints.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('missions')
        .insert({
          name: missionName,
          description: 'SAR mission — SIH simulation',
          unit_id: selectedUnit,
          payload: payload || null,
          waypoints: waypoints,
          geofence: defaultGeofence(),
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
      setPlanningMode(false);
      simulation.start(mission);
    } catch {
      // Fallback: start without DB
      const mission: Mission = {
        id: crypto.randomUUID(),
        name: missionName,
        description: null,
        unit_id: selectedUnit,
        payload: payload || null,
        waypoints,
        geofence: defaultGeofence(),
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
      setPlanningMode(false);
      simulation.start(mission);
    }
  }, [readOnly, waypoints, missionName, selectedUnit, payload]);

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
          type: 'survivor',
          message: `Medicine dispatched to ${survivor.survivor_id}`,
          data: null,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    }
  }, [survivors]);

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

  const handleAddWaypoint = useCallback((x: number, y: number) => {
    const wp: Waypoint = { x, y, label: `WP-${String(waypoints.length + 1).padStart(2, '0')}` };
    setWaypoints((prev) => [...prev, wp]);
  }, [waypoints.length]);

  const handleRemoveWaypoint = useCallback((index: number) => {
    setWaypoints((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((wp, i) => ({ ...wp, label: `WP-${String(i + 1).padStart(2, '0')}` }));
    });
  }, []);

  const unackAlertCount = alerts.filter((a) => !a.acknowledged).length;
  const obstacles = simulation.getObstacles();
  const roverUnit = telemetry.find((t) => t.unitId === 'ROVER_R1');

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
                  waypoints={waypoints}
                  geofence={defaultGeofence()}
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
            <div className="h-full grid grid-cols-12 gap-3">
              <div className="col-span-8 panel p-0 overflow-hidden relative">
                <TacticalMap
                  telemetry={telemetry}
                  survivors={survivors}
                  waypoints={waypoints}
                  geofence={defaultGeofence()}
                  obstacles={obstacles}
                  missionActive={missionActive}
                  planningMode={!missionActive && !readOnly}
                  onWaypointAdd={handleAddWaypoint}
                  onWaypointRemove={handleRemoveWaypoint}
                  selectedUnit={selectedUnit}
                  elapsed={elapsed}
                />
              </div>
              <div className="col-span-4 h-full">
                <MissionPlanner
                  waypoints={waypoints}
                  onWaypointsChange={setWaypoints}
                  selectedUnit={selectedUnit}
                  onUnitChange={setSelectedUnit}
                  missionName={missionName}
                  onMissionNameChange={setMissionName}
                  payload={payload}
                  onPayloadChange={setPayload}
                  missionActive={missionActive}
                  missionPaused={missionPaused}
                  onStart={handleStartMission}
                  onPause={handlePause}
                  onResume={handleResume}
                  onAbort={handleAbort}
                  onReturnToBase={handleReturnToBase}
                  readOnly={readOnly}
                  hasActiveMission={hasActiveMission}
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

          {activeView === 'logs' && (
            <div className="h-full">
              <MissionLog events={events} onExport={handleExportAAR} readOnly={readOnly} />
            </div>
          )}
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
