import { LayoutDashboard, Map, Crosshair, Users, FileText, Radar, LogOut } from 'lucide-react';
import type { UserRole } from '@/types';

export type ViewId = 'operations' | 'vehicles' | 'planner' | 'survivors' | 'mapping' | 'logs';

interface SidebarProps {
  activeView: ViewId;
  onViewChange: (view: ViewId) => void;
  role: UserRole;
  onSignOut: () => void;
  missionActive: boolean;
  alertCount: number;
}

const NAV_ITEMS: { id: ViewId; label: string; icon: typeof LayoutDashboard; commanderOnly?: boolean }[] = [
  { id: 'operations', label: 'Live Operations', icon: LayoutDashboard },
  { id: 'vehicles', label: 'Vehicle Panel', icon: Crosshair },
  { id: 'planner', label: 'Mission Planner', icon: Map },
  { id: 'survivors', label: 'Survivor Registry', icon: Users },
  { id: 'mapping', label: 'SLAM Mapping', icon: Radar },
  { id: 'logs', label: 'Mission Log', icon: FileText },
];

export function Sidebar({ activeView, onViewChange, role, onSignOut, missionActive, alertCount }: SidebarProps) {
  return (
    <div className="w-56 h-full bg-bg-secondary border-r border-white/10 flex flex-col">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-accent-amber/10 border border-accent-amber/30 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-accent-amber" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <h1 className="font-condensed text-sm font-bold text-white tracking-wide leading-none">AERO VOLTZ</h1>
            <p className="text-[9px] text-slate-500 tracking-widest uppercase mt-0.5">SAR Control</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto scrollbar-thin">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-left transition-all ${
                active
                  ? 'bg-accent-amber/10 text-accent-amber border-l-2 border-accent-amber'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-medium">{item.label}</span>
              {item.id === 'operations' && missionActive && (
                <span className="ml-auto status-dot status-dot-live" style={{ background: '#22c55e' }} />
              )}
              {item.id === 'operations' && alertCount > 0 && (
                <span className="ml-auto text-[9px] font-mono text-accent-red bg-accent-red/10 px-1.5 rounded">
                  {alertCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Role + Sign out */}
      <div className="px-2 py-3 border-t border-white/10">
        <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
          <div
            className={`w-2.5 h-2.5 rounded-full ${role === 'commander' ? 'bg-accent-amber' : 'bg-accent-teal'}`}
            style={{ boxShadow: `0 0 8px ${role === 'commander' ? 'rgba(245,158,11,0.5)' : 'rgba(20,184,166,0.5)'}` }}
          />
          <div className="flex-1">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Role</div>
            <div className="text-xs font-semibold text-white capitalize">{role}</div>
          </div>
        </div>
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-slate-500 hover:text-accent-red hover:bg-accent-red/5 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-xs font-medium">Sign Out</span>
        </button>
      </div>
    </div>
  );
}
