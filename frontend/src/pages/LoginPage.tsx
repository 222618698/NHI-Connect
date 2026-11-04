import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth';
import Logo from '../components/Logo';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    login(username.trim() || 'Clinician');
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

        <label htmlFor="u" className="mb-1.5 block text-[13px] font-semibold">Username</label>
        <input id="u" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. t.moloi" className={input} autoComplete="username" />

        <label htmlFor="p" className="mb-1.5 block text-[13px] font-semibold">Password</label>
        <input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={input + ' mb-6'} autoComplete="current-password" />

        <button type="submit" className="w-full rounded-lg bg-teal py-3 text-[15px] font-semibold text-white hover:bg-teal-dark">Sign In</button>
        <p className="mt-4 text-center text-xs text-ink-faint">Step 1 demo &mdash; any username and password will sign you in.</p>
      </form>
    </div>
  );
}
