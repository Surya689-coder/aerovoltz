import { Activity, ArrowUpRight, Battery, CheckCircle2, Clock3, MapPinned, Radio, ShieldAlert, Users } from 'lucide-react';
import type { Alert, MissionEvent, Survivor, UnitTelemetry } from '@/types';
import { UNIT_CONFIG, formatTime } from '@/lib/constants';

interface OverviewPageProps {
  telemetry: UnitTelemetry[];
  survivors: Survivor[];
  alerts: Alert[];
  events: MissionEvent[];
  missionActive: boolean;
  missionPaused: boolean;
  elapsed: number;
  onOpenView: (view: 'operations' | 'planner' | 'survivors' | 'logs') => void;
}

export function OverviewPage({
  telemetry,
  survivors,
  alerts,
  events,
  missionActive,
  missionPaused,
  elapsed,
  onOpenView,
}: OverviewPageProps) {
  const criticalAlerts = alerts.filter((alert) => alert.severity === 'critical' && !alert.acknowledged).length;
  const rescued = survivors.filter((survivor) => survivor.status === 'rescued').length;
  const averageBattery = telemetry.length
    ? Math.round(telemetry.reduce((total, unit) => total + unit.battery, 0) / telemetry.length)
    : 0;
  const activeUnits = telemetry.filter((unit) => unit.status !== 'Offline').length;
  const missionState = missionPaused ? 'PAUSED' : missionActive ? 'ACTIVE' : 'STANDBY';
  const missionTimeline = buildMissionTimeline(events);

  return (
    <div className="h-full overflow-y-auto scrollbar-thin pr-1 space-y-3">
      <section className="overview-hero panel grid-bg">
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 text-accent-amber text-[10px] font-mono uppercase tracking-[0.2em] mb-3">
            <span className="status-dot status-dot-live bg-accent-amber" />
            Field command brief / sector 07
          </div>
          <h1 className="font-condensed text-4xl sm:text-5xl font-bold uppercase tracking-wide text-white leading-none">
            See the whole field.
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-400">
            One operational picture for your air, ground, and survivor response teams.
            Keep the signal clear, the route deliberate, and every handoff visible.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={() => onOpenView('operations')}>
              <Radio className="w-4 h-4" /> Open live map
            </button>
            <button className="btn btn-secondary" onClick={() => onOpenView('planner')}>
              <MapPinned className="w-4 h-4" /> Plan a route
            </button>
          </div>
        </div>
        <div className="overview-hero__orbit" aria-hidden="true">
          <div className="overview-hero__ring overview-hero__ring--outer" />
          <div className="overview-hero__ring overview-hero__ring--inner" />
          <div className="overview-hero__signal" />
          <span className="overview-hero__marker overview-hero__marker--one" />
          <span className="overview-hero__marker overview-hero__marker--two" />
          <span className="overview-hero__marker overview-hero__marker--three" />
        </div>
        <div className="absolute right-5 top-5 flex items-center gap-2 text-[10px] font-mono text-slate-500">
          <span className={`w-2 h-2 rounded-full ${missionActive ? 'bg-accent-green animate-blink' : 'bg-slate-600'}`} />
          {missionState}
        </div>
      </section>

      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <MetricCard label="Units online" value={`${activeUnits}/${telemetry.length}`} detail="LINK HEALTH" icon={Radio} tone="teal" />
        <MetricCard label="Unresolved alerts" value={String(criticalAlerts)} detail="CRITICAL QUEUE" icon={ShieldAlert} tone="red" />
        <MetricCard label="Survivors tracked" value={String(survivors.length)} detail={`${rescued} RESCUED`} icon={Users} tone="amber" />
        <MetricCard label="Fleet battery" value={`${averageBattery}%`} detail="AVERAGE REMAINING" icon={Battery} tone="blue" />
      </section>

      <section className="panel overflow-hidden">
        <div className="panel-header">
          <div>
            <span className="panel-title">Mission / Event Timeline</span>
            <p className="text-[10px] text-slate-600 mt-1">RESQ X sequence from detection to completion</p>
          </div>
          <Clock3 className="w-4 h-4 text-slate-600" />
        </div>

        {missionTimeline.length === 0 ? (
          <div className="px-4 py-6 text-xs text-slate-600 font-mono">Awaiting mission events...</div>
        ) : (
          <div className="px-3 pb-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              {missionTimeline.map((event, index) => (
                <div key={`${event.unit}-${event.action}-${index}`} className="flex items-center gap-2 min-w-0">
                  <div className="rounded border border-white/10 bg-white/5 px-2 py-1.5 min-w-[120px]">
                    <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-slate-500">{event.unit}</div>
                    <div className="mt-1 text-[11px] text-slate-200">{event.action}</div>
                    <div className="mt-1 text-[9px] font-mono text-slate-500">{formatTime(event.time)}</div>
                  </div>
                  {index < missionTimeline.length - 1 && (
                    <div className="text-slate-600 text-sm">↓</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-5 gap-3">
        <div className="panel xl:col-span-3 overflow-hidden">
          <div className="panel-header">
            <div>
              <span className="panel-title">Fleet posture</span>
              <p className="text-[10px] text-slate-600 mt-1">Current readiness across deployed assets</p>
            </div>
            <button className="icon-link" onClick={() => onOpenView('operations')} aria-label="Open operations">
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
          <div className="divide-y divide-white/5">
            {telemetry.map((unit) => {
              const config = UNIT_CONFIG[unit.unitId];
              return (
                <div key={unit.unitId} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ background: `${config.color}18`, color: config.color }}>
                    <Activity className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white">{unit.name}</span>
                      <span className="text-[9px] font-mono text-slate-600">{unit.callsign}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">{unit.mode} / {unit.speed.toFixed(1)} m/s / {unit.signalStrength.toFixed(0)} dBm</div>
                  </div>
                  <div className="w-24 hidden sm:block">
                    <div className="flex justify-between text-[9px] font-mono text-slate-500 mb-1"><span>BATTERY</span><span>{unit.battery.toFixed(0)}%</span></div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${unit.battery}%`, background: unit.battery > 25 ? '#14b8a6' : '#ef4444' }} /></div>
                  </div>
                  <span className="badge" style={{ color: unit.status === 'Offline' ? '#ef4444' : '#14b8a6', background: unit.status === 'Offline' ? 'rgba(239,68,68,.1)' : 'rgba(20,184,166,.1)' }}>{unit.status}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel xl:col-span-2 overflow-hidden">
          <div className="panel-header">
            <div>
              <span className="panel-title">Latest activity</span>
              <p className="text-[10px] text-slate-600 mt-1">Live operational signal</p>
            </div>
            <Clock3 className="w-4 h-4 text-slate-600" />
          </div>
          <div className="p-3 space-y-1">
            {events.slice(0, 5).map((event) => (
              <div key={event.id} className="flex gap-2.5 py-2 border-b border-white/5 last:border-0">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent-amber flex-shrink-0" />
                <div className="min-w-0"><p className="text-[11px] text-slate-300 truncate">{event.message}</p><p className="text-[9px] text-slate-600 font-mono mt-1">{formatTime(event.created_at)} {event.unit_id ? ` / ${event.unit_id}` : ''}</p></div>
              </div>
            ))}
            {events.length === 0 && <p className="py-8 text-center text-xs text-slate-600">Awaiting field activity</p>}
          </div>
          <button className="w-full border-t border-white/5 px-4 py-3 text-left text-[10px] uppercase tracking-wider text-accent-amber hover:bg-white/5" onClick={() => onOpenView('logs')}>View mission log <ArrowUpRight className="inline w-3 h-3 ml-1" /></button>
        </div>
      </section>

      <div className="flex items-center gap-2 text-[10px] text-slate-600 font-mono"><CheckCircle2 className="w-3.5 h-3.5 text-accent-teal" /> SYSTEM CHECK COMPLETE <span className="text-slate-700">/</span> T+{Math.floor(elapsed / 1000)}s since mission clock start</div>
    </div>
  );
}

function buildMissionTimeline(events: MissionEvent[]) {
  const ordered = [...events].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const timeline: Array<{ unit: string; action: string; time: string }> = [];

  const detectEvent = ordered.find((event) => event.unit_id === 'SCOUT_S1' && /detected/i.test(event.message));
  if (detectEvent) {
    timeline.push({ unit: 'SCOUT S1', action: 'Survivor detected', time: detectEvent.created_at });
    timeline.push({ unit: 'Mission Hub', action: 'Detection received', time: detectEvent.created_at });
  }

  const roverAssigned = ordered.find((event) => event.unit_id === 'ROVER_R1' && /assigned|created/i.test(event.message));
  if (roverAssigned) {
    timeline.push({ unit: 'ROVER R1', action: 'Verification mission assigned', time: roverAssigned.created_at });
  }

  const roverVerified = ordered.find((event) => event.unit_id === 'ROVER_R1' && /verified|confirmed/i.test(event.message));
  if (roverVerified) {
    timeline.push({ unit: 'ROVER R1', action: 'Survivor verified', time: roverVerified.created_at });
  }

  const supplyCreated = ordered.find((event) => event.unit_id === 'MEDDROP' && /autonomous supply mission created|supply mission.*created/i.test(event.message));
  if (supplyCreated) {
    timeline.push({ unit: 'SUPPLY UAV', action: 'Mission created', time: supplyCreated.created_at });
  }

  const supplyDispatched = ordered.find((event) => event.unit_id === 'MEDDROP' && /dispatched/i.test(event.message));
  if (supplyDispatched) {
    timeline.push({ unit: 'SUPPLY UAV', action: 'Dispatched', time: supplyDispatched.created_at });
  }

  const supplyReached = ordered.find((event) => event.unit_id === 'MEDDROP' && /(at target|reached|arrived)/i.test(event.message));
  if (supplyReached) {
    timeline.push({ unit: 'SUPPLY UAV', action: 'Reached survivor', time: supplyReached.created_at });
  }

  const supplyDelivered = ordered.find((event) => event.unit_id === 'MEDDROP' && /(payload delivered|delivering payload|aid delivered)/i.test(event.message));
  if (supplyDelivered) {
    timeline.push({ unit: 'SUPPLY UAV', action: 'Aid delivered', time: supplyDelivered.created_at });
  }

  const supplyReturning = ordered.find((event) => event.unit_id === 'MEDDROP' && /(returning|returned to base)/i.test(event.message));
  if (supplyReturning) {
    timeline.push({ unit: 'SUPPLY UAV', action: 'Returning to base', time: supplyReturning.created_at });
  }

  const missionComplete = [...ordered].reverse().find((event) => /mission complete|mission completed|complete/i.test(event.message));
  if (missionComplete) {
    timeline.push({ unit: 'MISSION', action: 'COMPLETE', time: missionComplete.created_at });
  }

  return timeline.filter((event, index, array) => array.findIndex((item) => item.unit === event.unit && item.action === event.action && item.time === event.time) === index);
}

function MetricCard({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: typeof Activity; tone: 'teal' | 'red' | 'amber' | 'blue' }) {
  const colors = { teal: '#14b8a6', red: '#ef4444', amber: '#f59e0b', blue: '#38bdf8' };
  const color = colors[tone];
  return <div className="panel p-4 relative overflow-hidden"><div className="flex justify-between items-start"><div><div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div><div className="font-mono text-2xl font-semibold text-white mt-2">{value}</div></div><div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ color, background: `${color}18` }}><Icon className="w-4 h-4" /></div></div><div className="text-[9px] font-mono mt-3" style={{ color }}>{detail}</div></div>;
}
