import type { Alert } from '@/types';
import { ALERT_SEVERITY_CONFIG, ALERT_TYPE_LABELS, formatTime } from '@/lib/constants';
import { AlertTriangle, Bell, CheckCircle, Info, Radio, ShieldAlert, Zap } from 'lucide-react';

interface AlertFeedProps {
  alerts: Alert[];
  onAcknowledge?: (id: string) => void;
  readOnly: boolean;
}

const ALERT_ICONS: Record<string, typeof AlertTriangle> = {
  survivor_found: CheckCircle,
  low_battery: Zap,
  link_lost: Radio,
  payload_delivered: CheckCircle,
  geofence_breach: ShieldAlert,
  mission_started: Info,
  mission_completed: CheckCircle,
  waypoint_reached: Info,
  system: AlertTriangle,
};

export function AlertFeed({ alerts, onAcknowledge, readOnly }: AlertFeedProps) {
  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header">
        <span className="panel-title">Alert Feed</span>
        <div className="flex items-center gap-2">
          <span className="status-dot status-dot-live" style={{ background: '#ef4444' }} />
          <span className="text-[10px] text-slate-500 font-mono">{alerts.length} ACTIVE</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-600">
            <Bell className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-xs">No alerts</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {alerts.map((alert) => {
              const config = ALERT_SEVERITY_CONFIG[alert.severity];
              const Icon = ALERT_ICONS[alert.type] || AlertTriangle;
              return (
                <div
                  key={alert.id}
                  className={`px-3 py-2.5 hover:bg-white/2 transition-colors animate-fade-in ${
                    !alert.acknowledged && alert.severity === 'critical' ? 'animate-blink' : ''
                  }`}
                  style={{ background: !alert.acknowledged ? config.bg : 'transparent' }}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className="mt-0.5 w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                      style={{ background: config.color + '20' }}
                    >
                      <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className="badge text-[8px]"
                          style={{ background: config.color + '20', color: config.color, border: `1px solid ${config.color}40` }}
                        >
                          {config.label}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {formatTime(alert.created_at)}
                        </span>
                        {alert.unit_id && (
                          <span className="text-[10px] text-slate-600 font-mono">{alert.unit_id}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 leading-snug">{alert.message}</p>
                    </div>
                    {!alert.acknowledged && !readOnly && onAcknowledge && (
                      <button
                        onClick={() => onAcknowledge(alert.id)}
                        className="text-[10px] text-slate-500 hover:text-white transition-colors flex-shrink-0"
                      >
                        ACK
                      </button>
                    )}
                    {alert.acknowledged && (
                      <span className="text-[10px] text-slate-600 flex-shrink-0">✓</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
