import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import Logo from '../components/Logo';
import type { Role } from '../types';

// "Clinician / Nurse" is for everyone who works at a clinic. The account itself decides which dashboard opens:
// clinic staff accounts go to the Clinic dashboard, clinician and nurse accounts to patient search.
const ROLES: { value: Role; label: string }[] = [
  { value: 'CLINICIAN', label: 'Clinician / Nurse' },
  { value: 'ADMIN', label: 'Administrator' },
];

export default function LoginPage() {
  const { login, notice } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>('CLINICIAN');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return setError('Enter your username and password.');
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password, role);
      navigate('/', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const input = 'mb-5 w-full rounded-lg border border-[#D6DFE6] px-3.5 py-2.5 text-sm outline-none focus:border-teal';

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-[400px] rounded-2xl border border-line bg-white p-9 shadow-[0_2px_10px_rgba(20,30,40,0.06)]">
        <div className="mb-1.5 flex items-center gap-2.5">
          <Logo size={44} />
          <span className="text-xl font-bold tracking-tight">NHI-Connect</span>
        </div>
        <p className="mb-7 text-sm text-ink-muted">Sign in to continue</p>

        {notice && !error && <p className="mb-5 rounded-lg border border-amber-line bg-amber-tint px-4 py-2.5 text-[13px] text-amber-ink">{notice}</p>}

        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">Sign in as</p>
        <div className="mb-6 grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Sign in as">
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              role="radio"
              aria-checked={role === r.value}
              onClick={() => { setRole(r.value); setError(null); }}
              className={
                'rounded-lg border py-2.5 text-sm font-semibold transition-colors ' +
                (role === r.value ? 'border-teal bg-teal text-white' : 'border-[#D6DFE6] bg-white text-ink-muted hover:border-teal')
              }
            >
              {r.label}
            </button>
          ))}
        </div>

        <label htmlFor="u" className="mb-1.5 block text-[13px] font-semibold">Username</label>
        <input id="u" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. t.moloi" className={input} autoComplete="username" />

        <label htmlFor="p" className="mb-1.5 block text-[13px] font-semibold">Password</label>
        <input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={input + ' mb-6'} autoComplete="current-password" />

        {error && <p role="alert" className="mb-4 rounded-lg border border-[#F0C9C9] bg-[#FBE7E7] px-4 py-2.5 text-[13px] text-[#9C3B3B]">{error}</p>}

        <button type="submit" disabled={busy} className="w-full rounded-lg bg-teal py-3 text-[15px] font-semibold text-white hover:bg-teal-dark disabled:opacity-60">
          {busy ? 'Signing in…' : 'Sign In'}
        </button>
        <p className="mt-4 text-center text-xs text-ink-faint">Demo environment &mdash; sign in with the account your administrator gave you.</p>
      </form>
    </div>
  );
}
