import { useState } from 'react';
import type { UnitId, Waypoint } from '@/types';
import { UNIT_IDS, UNIT_CONFIG, generateWaypointLabel, defaultGeofence } from '@/lib/constants';
import { MapPin, Trash2, Play, Pause, OctagonX, Home, Package } from 'lucide-react';

interface MissionPlannerProps {
  waypoints: Waypoint[];
  onWaypointsChange: (wps: Waypoint[]) => void;
  selectedUnit: UnitId;
  onUnitChange: (unit: UnitId) => void;
  missionName: string;
  onMissionNameChange: (name: string) => void;
  payload: string;
  onPayloadChange: (p: string) => void;
  missionActive: boolean;
  missionPaused: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onAbort: () => void;
  onReturnToBase: () => void;
  readOnly: boolean;
  hasActiveMission: boolean;
}

export function MissionPlanner({
  waypoints,
  onWaypointsChange,
  selectedUnit,
  onUnitChange,
  missionName,
  onMissionNameChange,
  payload,
  onPayloadChange,
  missionActive,
  missionPaused,
  onStart,
  onPause,
  onResume,
  onAbort,
  onReturnToBase,
  readOnly,
  hasActiveMission,
}: MissionPlannerProps) {
  const [planningMode, setPlanningMode] = useState(!hasActiveMission);

  const addWaypoint = (x: number, y: number) => {
    const wp: Waypoint = { x, y, label: generateWaypointLabel(waypoints.length) };
    onWaypointsChange([...waypoints, wp]);
  };

  const removeWaypoint = (index: number) => {
    const updated = waypoints.filter((_, i) => i !== index);
    const relabeled = updated.map((wp, i) => ({ ...wp, label: generateWaypointLabel(i) }));
    onWaypointsChange(relabeled);
  };

  const clearWaypoints = () => {
    onWaypointsChange([]);
  };

  const canStart = waypoints.length > 0 && missionName.trim().length > 0 && !missionActive && !readOnly;

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header">
        <span className="panel-title">Mission Planner</span>
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

      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
        {/* Mission Name */}
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

        {/* Unit Selection */}
        <div>
          <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">Assigned Unit</label>
          <div className="grid grid-cols-3 gap-2">
            {UNIT_IDS.map((id) => {
              const cfg = UNIT_CONFIG[id];
              const selected = selectedUnit === id;
              return (
                <button
                  key={id}
                  onClick={() => onUnitChange(id)}
                  disabled={missionActive || readOnly}
                  className={`p-2 rounded-md border text-center transition-all ${
                    selected
                      ? 'border-accent-amber bg-accent-amber/10'
                      : 'border-white/10 hover:border-white/20'
                  } ${missionActive || readOnly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="text-[10px] font-semibold text-white font-condensed">{cfg.name}</div>
                  <div className="text-[8px] text-slate-500 font-mono">{cfg.callsign}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Payload (for MEDDROP) */}
        <div>
          <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">
            Payload {selectedUnit === 'MEDDROP' ? '' : '(MEDDROP only)'}
          </label>
          <input
            type="text"
            value={payload}
            onChange={(e) => onPayloadChange(e.target.value)}
            className="input"
            placeholder="Medical kit, water, rations"
            disabled={missionActive || readOnly || selectedUnit !== 'MEDDROP'}
          />
        </div>

        {/* Planning mode toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">Planning Mode</span>
          <button
            onClick={() => setPlanningMode(!planningMode)}
            disabled={missionActive || readOnly}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              planningMode ? 'bg-accent-amber' : 'bg-white/10'
            } ${missionActive || readOnly ? 'opacity-50' : ''}`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                planningMode ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* Waypoint list */}
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
                <p className="text-[10px]">
                  {planningMode ? 'Click map to add waypoints' : 'Enable planning mode'}
                </p>
              </div>
            ) : (
              waypoints.map((wp, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-bg-tertiary rounded-md px-2.5 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-accent-amber/20 text-accent-amber flex items-center justify-center text-[9px] font-mono font-bold">
                      {i + 1}
                    </span>
                    <span className="text-xs font-mono text-slate-300">{wp.label}</span>
                    <span className="text-[10px] font-mono text-slate-600">
                      {wp.x.toFixed(0)}, {wp.y.toFixed(0)}
                    </span>
                  </div>
                  {!missionActive && !readOnly && (
                    <button
                      onClick={() => removeWaypoint(i)}
                      className="text-slate-600 hover:text-accent-red transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Geofence info */}
        <div className="pt-2 border-t border-white/5">
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <ShieldIcon />
            <span>Geofence: {defaultGeofence().length} vertices defined</span>
          </div>
        </div>
      </div>

      {/* Mission controls */}
      <div className="border-t border-white/10 p-3 space-y-2">
        {!missionActive && !missionPaused && (
          <button
            onClick={onStart}
            disabled={!canStart}
            className="btn btn-primary w-full justify-center"
          >
            <Play className="w-3.5 h-3.5" /> Start Mission
          </button>
        )}
        {missionActive && !missionPaused && (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={onPause} disabled={readOnly} className="btn btn-secondary justify-center">
              <Pause className="w-3.5 h-3.5" /> Pause
            </button>
            <button onClick={onAbort} disabled={readOnly} className="btn btn-danger justify-center">
              <OctagonX className="w-3.5 h-3.5" /> Abort
            </button>
          </div>
        )}
        {missionPaused && (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={onResume} disabled={readOnly} className="btn btn-teal justify-center">
              <Play className="w-3.5 h-3.5" /> Resume
            </button>
            <button onClick={onAbort} disabled={readOnly} className="btn btn-danger justify-center">
              <OctagonX className="w-3.5 h-3.5" /> Abort
            </button>
          </div>
        )}
        {missionActive && (
          <button onClick={onReturnToBase} disabled={readOnly} className="btn btn-secondary w-full justify-center">
            <Home className="w-3.5 h-3.5" /> Return to Base
          </button>
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

export { MissionPlanner as default };
