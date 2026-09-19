import { BarChart3, Battery, Clock3, Download, Gauge, Radio, TrendingUp, Users } from 'lucide-react';
import type { Alert, Survivor, UnitTelemetry } from '@/types';

interface AnalyticsPageProps {
  telemetry: UnitTelemetry[];
  survivors: Survivor[];
  alerts: Alert[];
  elapsed: number;
  onExport: () => void;
}

export function AnalyticsPage({ telemetry, survivors, alerts, elapsed, onExport }: AnalyticsPageProps) {
  const avgSignal = telemetry.length ? Math.round(telemetry.reduce((sum, unit) => sum + unit.signalStrength, 0) / telemetry.length) : 0;
  const avgSpeed = telemetry.length ? (telemetry.reduce((sum, unit) => sum + unit.speed, 0) / telemetry.length).toFixed(1) : '0.0';
  const acknowledged = alerts.filter((alert) => alert.acknowledged).length;
  const rescueRate = survivors.length ? Math.round((survivors.filter((survivor) => survivor.status === 'rescued').length / survivors.length) * 100) : 0;
  const bars = [34, 48, 42, 66, 57, 74, 61, 83, 69, 91, 78, 88];

  return (
    <div className="h-full overflow-y-auto scrollbar-thin pr-1 space-y-3">
      <div className="page-heading"><div><div className="eyebrow">Performance intelligence / last deployment</div><h1 className="page-title">Mission analytics</h1><p className="page-subtitle">Turn field telemetry into decisions your team can act on.</p></div><button className="btn btn-secondary" onClick={onExport}><Download className="w-4 h-4" /> Export report</button></div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Kpi icon={Clock3} label="Mission time" value={`${Math.floor(elapsed / 60000)}m ${Math.floor((elapsed % 60000) / 1000)}s`} tone="#f59e0b" />
        <Kpi icon={Gauge} label="Average speed" value={`${avgSpeed} m/s`} tone="#38bdf8" />
        <Kpi icon={Radio} label="Link quality" value={`${avgSignal} dBm`} tone="#14b8a6" />
        <Kpi icon={Users} label="Rescue conversion" value={`${rescueRate}%`} tone="#22c55e" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-3">
        <div className="panel xl:col-span-3 p-4">
          <div className="flex items-start justify-between"><div><span className="panel-title">Fleet activity</span><p className="text-[10px] text-slate-600 mt-1">Signal density over mission time</p></div><BarChart3 className="w-4 h-4 text-slate-600" /></div>
          <div className="analytics-chart mt-8">{bars.map((height, index) => <div key={index} className="analytics-bar-wrap"><div className="analytics-bar" style={{ height: `${height}%`, animationDelay: `${index * 45}ms` }} /><span>{String(index + 1).padStart(2, '0')}</span></div>)}</div>
          <div className="flex justify-between text-[9px] font-mono text-slate-600 mt-3"><span>START</span><span>MISSION CLOCK</span><span>NOW</span></div>
        </div>
        <div className="panel xl:col-span-2 overflow-hidden"><div className="panel-header"><span className="panel-title">Response health</span><TrendingUp className="w-4 h-4 text-accent-teal" /></div><div className="p-4 space-y-4"><HealthRow label="Alert acknowledgement" value={alerts.length ? Math.round((acknowledged / alerts.length) * 100) : 100} color="#f59e0b" /><HealthRow label="Survivor verification" value={survivors.length ? Math.round((survivors.filter((s) => s.status !== 'reported').length / survivors.length) * 100) : 0} color="#38bdf8" /><HealthRow label="Fleet availability" value={telemetry.length ? Math.round((telemetry.filter((unit) => unit.status !== 'Offline').length / telemetry.length) * 100) : 0} color="#14b8a6" /></div></div>
      </div>
      <div className="panel overflow-hidden"><div className="panel-header"><div><span className="panel-title">Asset efficiency</span><p className="text-[10px] text-slate-600 mt-1">Telemetry snapshot by deployed unit</p></div><Battery className="w-4 h-4 text-slate-600" /></div><div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="text-[9px] uppercase tracking-wider text-slate-600 border-b border-white/5"><th className="px-4 py-3">Unit</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Battery</th><th className="px-4 py-3">Signal</th><th className="px-4 py-3">Mode</th></tr></thead><tbody>{telemetry.map((unit) => <tr key={unit.unitId} className="border-b border-white/5 last:border-0 text-xs"><td className="px-4 py-3 font-semibold text-white">{unit.name}<span className="block text-[9px] font-mono text-slate-600 mt-1">{unit.callsign}</span></td><td className="px-4 py-3 text-accent-teal">{unit.status}</td><td className="px-4 py-3 font-mono text-slate-300">{unit.battery.toFixed(0)}%</td><td className="px-4 py-3 font-mono text-slate-300">{unit.signalStrength.toFixed(0)} dBm</td><td className="px-4 py-3 text-slate-400">{unit.mode}</td></tr>)}</tbody></table></div></div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: typeof Clock3; label: string; value: string; tone: string }) { return <div className="panel p-4"><Icon className="w-4 h-4" style={{ color: tone }} /><div className="text-[10px] text-slate-500 uppercase tracking-wider mt-4">{label}</div><div className="font-mono text-xl text-white mt-1">{value}</div></div>; }
function HealthRow({ label, value, color }: { label: string; value: number; color: string }) { return <div><div className="flex justify-between text-[10px] mb-1.5"><span className="text-slate-400">{label}</span><span className="font-mono" style={{ color }}>{value}%</span></div><div className="h-1.5 bg-white/5 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: color }} /></div></div>; }
