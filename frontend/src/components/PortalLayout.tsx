import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';
import { ROLE_LABEL } from '../format';
import Logo from './Logo';

export interface NavItem {
  to: string;
  label: string;
  /** Page title shown in the top bar. Defaults to the label. */
  title?: string;
  end?: boolean;
  /** Shown as a small grey tag next to the label, e.g. "demo". */
  tag?: string;
}

/** Sidebar + top bar shell shared by the Administrator and Clinic portals. */
export default function PortalLayout({ nav, subtitle }: { nav: NavItem[]; subtitle?: string }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  // Longest matching prefix wins, so /clinic/patients/123 is titled "Patients".
  const current = [...nav].sort((a, b) => b.to.length - a.to.length).find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)));

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="shrink-0 border-b border-line bg-white md:w-[240px] md:border-b-0 md:border-r">
        <div className="px-6 py-6">
          <div className="flex items-center gap-2.5">
            <Logo size={32} />
            <span className="text-base font-bold">NHI-Connect</span>
          </div>
          {subtitle && <p className="mt-2 text-xs font-semibold text-ink-muted">{subtitle}</p>}
        </div>
        <nav className="flex overflow-x-auto md:flex-col">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                'flex items-center gap-2 whitespace-nowrap border-l-[3px] px-6 py-3 text-[15px] font-semibold ' +
                (isActive ? 'border-teal bg-teal-tint text-teal' : 'border-transparent text-ink-muted hover:bg-canvas hover:text-ink')
              }
            >
              {n.label}
              {n.tag && <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">{n.tag}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-line bg-white px-6 py-5 sm:px-10">
          <h1 className="text-base font-bold">{current?.title ?? current?.label ?? 'NHI-Connect'}</h1>
          <div className="flex items-center gap-4">
            {user && (
              <span className="hidden text-sm text-ink-soft sm:inline">
                {user.fullName} <span className="text-ink-faint">&middot; {ROLE_LABEL[user.role]}</span>
              </span>
            )}
            <button onClick={logout} className="whitespace-nowrap rounded-lg border border-[#D6DFE6] bg-white px-4 py-2 text-[13px] font-semibold text-ink-muted hover:bg-canvas">
              Log Out
            </button>
          </div>
        </header>
        <main className="flex-1 px-6 py-10 sm:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
