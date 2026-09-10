import type { MissionEvent } from '@/types';
import { formatTime } from '@/lib/constants';
import { Activity, AlertTriangle, CheckCircle, Info, MapPin, Radio, Zap } from 'lucide-react';

interface MissionLogProps {
  events: MissionEvent[];
  onExport: () => void;
  readOnly: boolean;
}

const EVENT_ICONS: Record<string, typeof Activity> = {
  telemetry: Activity,
  mission: CheckCircle,
  survivor: MapPin,
  alert: AlertTriangle,
  system: Info,
};

const EVENT_COLORS: Record<string, string> = {
  telemetry: '#64748b',
  mission: '#38bdf8',
  survivor: '#f59e0b',
  alert: '#ef4444',
  system: '#94a3b8',
};

export function MissionLog({ events, onExport, readOnly }: MissionLogProps) {
  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header">
        <span className="panel-title">Mission Log & Reports</span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-500 font-mono">{events.length} EVENTS</span>
          {!readOnly && (
            <button
              onClick={onExport}
              className="btn btn-secondary text-[10px] py-1 px-2"
            >
              <DownloadIcon /> Export AAR
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-600">
            <Activity className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-xs">No events logged</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-white/5" />

            <div className="divide-y divide-white/5">
              {events.map((event) => {
                const Icon = EVENT_ICONS[event.type] || Info;
                const color = EVENT_COLORS[event.type] || '#94a3b8';
                return (
                  <div key={event.id} className="flex items-start gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors animate-fade-in relative">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 z-10 border-2"
                      style={{ background: color + '20', borderColor: color + '40' }}
                    >
                      <Icon className="w-3 h-3" style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {event.unit_id && (
                          <span className="text-[10px] font-mono font-semibold" style={{ color }}>
                            {event.unit_id}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-600 font-mono">
                          {formatTime(event.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-snug">{event.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
