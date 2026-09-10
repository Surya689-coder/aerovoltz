import type { Survivor } from '@/types';
import {
  SURVIVOR_SEVERITY_CONFIG,
  SURVIVOR_STATUS_CONFIG,
  UNIT_CONFIG,
  formatTime,
  confidenceColor,
} from '@/lib/constants';

interface SurvivorRegistryProps {
  survivors: Survivor[];
  onUpdateStatus?: (id: string, status: string) => void;
  onDispatchMedicine?: (id: string) => void;
  readOnly: boolean;
}

const STATUS_FLOW = ['reported', 'verified', 'aided', 'rescued'] as const;

export function SurvivorRegistry({
  survivors,
  onUpdateStatus,
  onDispatchMedicine,
  readOnly,
}: SurvivorRegistryProps) {
  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header">
        <span className="panel-title">Survivor Registry</span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-500 font-mono">{survivors.length} DETECTIONS</span>
          <div className="flex items-center gap-1.5">
            <span className="status-dot status-dot-live" style={{ background: '#f59e0b' }} />
            <span className="text-[10px] text-slate-500 font-mono">LIVE</span>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-bg-card border-b border-white/10">
            <tr>
              <th className="text-left px-3 py-2 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">ID</th>
              <th className="text-left px-3 py-2 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Coordinates</th>
              <th className="text-left px-3 py-2 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Detected By</th>
              <th className="text-left px-3 py-2 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Severity</th>
              <th className="text-left px-3 py-2 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Confidence</th>
              <th className="text-left px-3 py-2 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Medicine</th>
              <th className="text-left px-3 py-2 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Status</th>
              <th className="text-left px-3 py-2 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Time</th>
              {!readOnly && <th className="px-3 py-2 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {survivors.length === 0 ? (
              <tr>
                <td colSpan={readOnly ? 8 : 9} className="text-center py-8 text-slate-600">
                  No survivors detected yet
                </td>
              </tr>
            ) : (
              survivors.map((s) => {
              const sevConfig = SURVIVOR_SEVERITY_CONFIG[s.severity];
              const statusConfig = SURVIVOR_STATUS_CONFIG[s.status];
              const confColor = confidenceColor(s.confidence);
              const unitCfg = UNIT_CONFIG[s.detected_by];

              return (
                <tr key={s.id} className="hover:bg-white/5 transition-colors animate-fade-in">
                  <td className="px-3 py-2.5 font-mono font-semibold text-white">{s.survivor_id}</td>
                  <td className="px-3 py-2.5 font-mono text-slate-400 text-[11px]">
                    {s.lat.toFixed(0)}, {s.lng.toFixed(0)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-[11px]" style={{ color: unitCfg.color }}>
                      {unitCfg.name}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className="badge"
                      style={{ background: sevConfig.bg, color: sevConfig.color, border: `1px solid ${sevConfig.color}40` }}
                    >
                      {sevConfig.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-12 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${s.confidence * 100}%`, background: confColor }}
                        />
                      </div>
                      <span className="font-mono text-[11px]" style={{ color: confColor }}>
                        {(s.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    {s.medicine_dispatched ? (
                      <span className="text-[10px] text-accent-green font-semibold">DISPATCHED</span>
                    ) : (
                      <span className="text-[10px] text-slate-600">PENDING</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className="badge"
                      style={{
                        background: statusConfig.color + '20',
                        color: statusConfig.color,
                        border: `1px solid ${statusConfig.color}40`,
                      }}
                    >
                      {statusConfig.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500">
                    {formatTime(s.detected_at)}
                  </td>
                  {!readOnly && (
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        {!s.medicine_dispatched && (
                          <button
                            onClick={() => onDispatchMedicine?.(s.id)}
                            className="text-[9px] px-1.5 py-1 rounded text-accent-amber bg-accent-amber/10 hover:bg-accent-amber/20 transition-colors"
                          >
                            DISPATCH
                          </button>
                        )}
                        {s.status !== 'rescued' && (
                          <button
                            onClick={() => {
                              const idx = STATUS_FLOW.indexOf(s.status as (typeof STATUS_FLOW)[number]);
                              if (idx < STATUS_FLOW.length - 1) {
                                onUpdateStatus?.(s.id, STATUS_FLOW[idx + 1]);
                              }
                            }}
                            className="text-[9px] px-1.5 py-1 rounded text-accent-teal bg-accent-teal/10 hover:bg-accent-teal/20 transition-colors"
                          >
                            ADVANCE
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
