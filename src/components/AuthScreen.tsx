import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/types';

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('commander');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result =
      mode === 'signin' ? await signIn(email, password) : await signUp(email, password, role);

    if (result.error) {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary grid-bg p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-lg bg-accent-amber/10 border border-accent-amber/30 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-7 h-7 text-accent-amber" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
          </div>
          <h1 className="font-condensed text-2xl font-bold text-white tracking-wide">AERO VOLTZ</h1>
          <p className="text-xs text-slate-500 mt-1 tracking-widest uppercase">SAR Mission Control</p>
        </div>

        <div className="panel p-6">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setMode('signin')}
              className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider rounded-md transition-colors ${
                mode === 'signin'
                  ? 'bg-accent-amber text-bg-primary'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider rounded-md transition-colors ${
                mode === 'signup'
                  ? 'bg-accent-amber text-bg-primary'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="commander@aerovoltz.io"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            {mode === 'signup' && (
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">Role</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('commander')}
                    className={`p-3 rounded-md border text-left transition-colors ${
                      role === 'commander'
                        ? 'border-accent-amber bg-accent-amber/10'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="text-xs font-semibold text-white">Commander</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Full control</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('observer')}
                    className={`p-3 rounded-md border text-left transition-colors ${
                      role === 'observer'
                        ? 'border-accent-teal bg-accent-teal/10'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="text-xs font-semibold text-white">Observer</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Read-only</div>
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="text-xs text-accent-red bg-accent-red/10 border border-accent-red/20 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary w-full justify-center">
              {loading ? 'Connecting...' : mode === 'signin' ? 'Access Dashboard' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-white/5 text-center">
            <p className="text-[10px] text-slate-600 uppercase tracking-wider">
              SIH 2026 — Search & Rescue Simulation
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
