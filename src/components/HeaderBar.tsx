import { useEffect, useState } from 'react';
import { Clock, Activity, Wifi } from 'lucide-react';
import { formatDuration } from '@/lib/constants';

interface HeaderBarProps {
  viewTitle: string;
  missionActive: boolean;
  missionPaused: boolean;
  elapsed: number;
  unitCount: number;
  survivorCount: number;
  alertCount: number;
}

export function HeaderBar({
  viewTitle,
  missionActive,
  missionPaused,
  elapsed,
  unitCount,
  survivorCount,
  alertCount,
}: HeaderBarProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="h-12 bg-bg-secondary border-b border-white/10 flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <h2 className="font-condensed text-base font-semibold text-white tracking-wide uppercase">{viewTitle}</h2>
        {missionActive && (
          <div className="flex items-center gap-1.5">
            <span className="status-dot status-dot-live" style={{ background: '#22c55e' }} />
            <span className="text-[10px] text-accent-green font-mono font-semibold uppercase tracking-wider">Live</span>
          </div>
        )}
        {missionPaused && (
          <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
            PAUSED
          </span>
        )}
      </div>

      <div className="flex items-center gap-5">
        {/* Mission timer */}
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span className="font-mono text-xs text-slate-300">
            T+{formatDuration(missionActive || missionPaused ? elapsed : 0)}
          </span>
        </div>

        {/* Units online */}
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-accent-teal" />
          <span className="font-mono text-xs text-slate-300">{unitCount} UNITS</span>
        </div>

        {/* Survivors */}
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-accent-amber" />
          <span className="font-mono text-xs text-slate-300">{survivorCount} SURVIVORS</span>
        </div>

        {/* Alerts */}
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${alertCount > 0 ? 'bg-accent-red animate-blink' : 'bg-slate-700'}`} />
          <span className="font-mono text-xs text-slate-300">{alertCount} ALERTS</span>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-white/10" />

        {/* System time */}
        <div className="flex items-center gap-2">
          <Wifi className="w-3.5 h-3.5 text-accent-teal" />
          <span className="font-mono text-xs text-slate-400">
            {time.toLocaleTimeString('en-US', { hour12: false })}
          </span>
        </div>
      </div>
    </div>
  );
}
