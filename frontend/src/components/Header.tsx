import type { ReactNode } from 'react';
import { useAuth } from '../auth';
import Logo from './Logo';

export default function Header({ left }: { left?: ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <header className="flex items-center justify-between gap-4 border-b border-line bg-white px-6 py-4 sm:px-10">
      {left ?? (
        <div className="flex items-center gap-2.5">
          <Logo size={32} />
          <span className="text-base font-bold">
            NHI-Connect <span className="font-medium text-ink-faint">&middot; Clinician Portal</span>
          </span>
        </div>
      )}
      <div className="flex items-center gap-4">
        <span className="hidden text-sm text-ink-soft sm:inline">
          {user?.fullName} <span className="text-ink-faint">&middot; {user?.facilityName ?? 'Clinician'}</span>
        </span>
        <button onClick={logout} className="whitespace-nowrap rounded-lg border border-[#D6DFE6] bg-white px-4 py-2 text-[13px] font-semibold text-ink-muted hover:bg-canvas">
          Log Out
        </button>
      </div>
    </header>
  );
}
