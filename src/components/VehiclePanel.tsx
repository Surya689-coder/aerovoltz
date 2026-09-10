import type { UnitTelemetry } from '@/types';
import {
  UNIT_CONFIG,
  STATUS_COLORS,
  batteryColor,
  signalColor,
} from '@/lib/constants';
import { Plane, Cpu, Radio, Battery, Gauge, Navigation, Wifi, Activity } from 'lucide-react';

interface VehiclePanelProps {
  telemetry: UnitTelemetry[];
  selectedUnit: string;
  onSelectUnit: (id: string) => void;
  missionActive: boolean;
}

export function VehiclePanel({ telemetry, selectedUnit, onSelectUnit, missionActive }: VehiclePanelProps) {
  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto scrollbar-thin pr-1">
      {telemetry.map((t) => {
        const cfg = UNIT_CONFIG[t.unitId];
        const isSelected = t.unitId === selectedUnit;
        const statusColor = STATUS_COLORS[t.status];
        const bColor = batteryColor(t.battery);
        const sColor = signalColor(t.signalStrength);

        return (
          <div
            key={t.unitId}
            onClick={() => onSelectUnit(t.unitId)}
            className={`panel cursor-pointer transition-all duration-200 ${
              isSelected ? 'ring-1 ring-accent-amber' : 'hover:border-white/20'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-md flex items-center justify-center"
                  style={{ background: cfg.color + '20', border: `1px solid ${cfg.color}40` }}
                >
                  {cfg.type === 'drone' ? (
                    <Plane className="w-4 h-4" style={{ color: cfg.color }} />
                  ) : (
                    <Cpu className="w-4 h-4" style={{ color: cfg.color }} />
                  )}
                </div>
                <div>
                  <div className="text-xs font-semibold text-white font-condensed tracking-wide">
                    {t.name}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">{t.callsign}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {missionActive && (
                  <span className="status-dot status-dot-live" style={{ background: '#22c55e' }} />
                )}
                <span
                  className="badge"
                  style={{
                    background: statusColor + '20',
                    color: statusColor,
                    border: `1px solid ${statusColor}40`,
                  }}
                >
                  {t.status}
                </span>
              </div>
            </div>

            {/* Telemetry grid */}
            <div className="p-3 grid grid-cols-2 gap-2">
              {/* Battery */}
              <div className="bg-bg-tertiary rounded-md p-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <Battery className="w-3 h-3" style={{ color: bColor }} />
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider">Battery</span>
                </div>
                <div className="font-mono text-sm font-semibold" style={{ color: bColor }}>
                  {t.battery.toFixed(0)}%
                </div>
                <div className="mt-1 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${t.battery}%`, background: bColor }}
                  />
                </div>
              </div>

              {/* Signal */}
              <div className="bg-bg-tertiary rounded-md p-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <Wifi className="w-3 h-3" style={{ color: sColor }} />
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider">Signal</span>
                </div>
                <div className="font-mono text-sm font-semibold" style={{ color: sColor }}>
                  {t.signalStrength.toFixed(0)} dBm
                </div>
                <div className="mt-1 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.max(0, Math.min(100, ((t.signalStrength + 100) / 100) * 100))}%`,
                      background: sColor,
                    }}
                  />
                </div>
              </div>

              {/* Altitude */}
              <div className="bg-bg-tertiary rounded-md p-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <Navigation className="w-3 h-3 text-slate-400" />
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider">Altitude</span>
                </div>
                <div className="font-mono text-sm font-semibold text-white">
                  {t.altitude.toFixed(1)}<span className="text-[10px] text-slate-500 ml-0.5">m</span>
                </div>
              </div>

              {/* Speed */}
              <div className="bg-bg-tertiary rounded-md p-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <Gauge className="w-3 h-3 text-slate-400" />
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider">Speed</span>
                </div>
                <div className="font-mono text-sm font-semibold text-white">
                  {t.speed.toFixed(1)}<span className="text-[10px] text-slate-500 ml-0.5">m/s</span>
                </div>
              </div>

              {/* GPS */}
              <div className="bg-bg-tertiary rounded-md p-2 col-span-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <Radio className="w-3 h-3 text-slate-400" />
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider">GPS</span>
                </div>
                <div className="font-mono text-[11px] text-slate-300">
                  {t.gpsLat}, {t.gpsLng}
                </div>
              </div>

              {/* Mode + Armed */}
              <div className="bg-bg-tertiary rounded-md p-2 col-span-2 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Activity className="w-3 h-3 text-slate-400" />
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider">Mode</span>
                  </div>
                  <div className="font-mono text-xs font-semibold text-white">{t.mode}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider">Armed</span>
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      background: t.armed ? '#22c55e' : '#475569',
                      boxShadow: t.armed ? '0 0 8px rgba(34, 197, 94, 0.5)' : 'none',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Camera thumbnail */}
            <div className="px-3 pb-3">
              <div className="relative h-20 bg-bg-primary rounded-md overflow-hidden border border-white/5">
                <CameraFeed unitId={t.unitId} x={t.x} y={t.y} heading={t.heading} status={t.status} />
                <div className="absolute top-1 left-1 text-[8px] font-mono text-accent-teal/80 bg-black/40 px-1 rounded">
                  CAM {t.callsign}
                </div>
                <div className="absolute top-1 right-1 text-[8px] font-mono text-white/60 bg-black/40 px-1 rounded">
                  ● REC
                </div>
                <div className="absolute bottom-1 left-1 text-[8px] font-mono text-white/40">
                  {t.gpsLat}
                </div>
                <div className="absolute bottom-1 right-1 text-[8px] font-mono text-white/40">
                  {t.gpsLng}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CameraFeed({
  unitId,
  x,
  y,
  heading,
  status,
}: {
  unitId: string;
  x: number;
  y: number;
  heading: number;
  status: string;
}) {
  return (
    <div className="w-full h-full relative grid-bg">
      <div className="absolute inset-0 flex items-center justify-center">
        <svg viewBox="0 0 100 60" className="w-full h-full">
          <defs>
            <radialGradient id={`cam-${unitId}`} cx="50%" cy="50%">
              <stop offset="0%" stopColor="rgba(20, 184, 166, 0.1)" />
              <stop offset="100%" stopColor="rgba(10, 14, 20, 0.9)" />
            </radialGradient>
          </defs>
          <rect width="100" height="60" fill={`url(#cam-${unitId})`} />

          {/* Crosshair */}
          <line x1="50" y1="20" x2="50" y2="40" stroke="rgba(20, 184, 166, 0.3)" strokeWidth="0.3" />
          <line x1="40" y1="30" x2="60" y2="30" stroke="rgba(20, 184, 166, 0.3)" strokeWidth="0.3" />
          <circle cx="50" cy="30" r="8" fill="none" stroke="rgba(20, 184, 166, 0.2)" strokeWidth="0.3" />

          {/* Simulated terrain features based on position */}
          <rect x="15" y="10" width="12" height="8" fill="rgba(100, 116, 139, 0.15)" stroke="rgba(100, 116, 139, 0.3)" strokeWidth="0.2" />
          <rect x="70" y="15" width="15" height="10" fill="rgba(100, 116, 139, 0.15)" stroke="rgba(100, 116, 139, 0.3)" strokeWidth="0.2" />
          <rect x="25" y="40" width="18" height="12" fill="rgba(100, 116, 139, 0.15)" stroke="rgba(100, 116, 139, 0.3)" strokeWidth="0.2" />
          <rect x="65" y="42" width="10" height="8" fill="rgba(100, 116, 139, 0.15)" stroke="rgba(100, 116, 139, 0.3)" strokeWidth="0.2" />

          {/* Heading indicator */}
          <g transform={`rotate(${heading} 50 30)`}>
            <path d="M50 25 L52 33 L50 31 L48 33 Z" fill="rgba(56, 189, 248, 0.6)" />
          </g>

          {/* Scan effect */}
          {status === 'Scanning' && (
            <line x1="0" y1="30" x2="100" y2="30" stroke="rgba(20, 184, 166, 0.4)" strokeWidth="0.5">
              <animate attributeName="y1" from="0" to="60" dur="2s" repeatCount="indefinite" />
              <animate attributeName="y2" from="0" to="60" dur="2s" repeatCount="indefinite" />
            </line>
          )}

          {/* Position overlay */}
          <text x="3" y="58" fill="rgba(255,255,255,0.3)" fontSize="3" fontFamily="monospace">
            X:{x.toFixed(0)} Y:{y.toFixed(0)} HDG:{heading.toFixed(0)}°
          </text>
        </svg>
      </div>
    </div>
  );
}
