import { Link } from 'react-router-dom';
import { api } from '../api';
import AuditTable from '../components/AuditTable';
import UpdatesList from '../components/UpdatesList';
import { Card, ErrorBox, PageHeading, StatTile, secondaryBtn } from '../components/ui';
import { ROLE_LABEL, fmtAgo, fmtStamp } from '../format';
import { useLoad } from '../useLoad';

export default function AdminOverviewPage() {
  const overview = useLoad(api.adminOverview);
  const recent = useLoad(() => api.audit({}));
  const updates = useLoad(api.adminUpdates);
  const reload = () => { overview.reload(); recent.reload(); updates.reload(); };
  const pending = updates.data?.filter((u) => !u.reviewedAt).length ?? 0;

  const s = overview.data?.stats;
  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeading title="Network Overview" sub="Who is signed in right now, and what they are looking at.">
        <button onClick={reload} className={secondaryBtn}>Refresh</button>
      </PageHeading>

      {overview.error && <ErrorBox>{overview.error}</ErrorBox>}

      {s && (
        <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatTile label="Clinics" value={s.facilities} />
          <StatTile label="Active accounts" value={s.users} />
          <StatTile label="Patients" value={s.patients} />
          <StatTile label="Sign-ins today" value={s.signInsToday} />
          <StatTile label="Failed sign-ins today" value={s.failedSignInsToday} tone={s.failedSignInsToday ? 'bad' : undefined} />
          <StatTile label="Record views today" value={s.recordViewsToday} />
        </div>
      )}

      <div className="mb-8">
        <Card title={`Signed in now${overview.data ? ` (${overview.data.activeSessions.length})` : ''}`}>
          {overview.data && overview.data.activeSessions.length === 0 && <p className="text-sm text-ink-muted">Nobody is signed in.</p>}
          <ul className="divide-y divide-line">
            {overview.data?.activeSessions.map((a, i) => (
              <li key={`${a.username}-${i}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-teal" aria-hidden />
                  <span>
                    <span className="block text-[15px] font-semibold">{a.fullName}</span>
                    <span className="block text-[13px] text-ink-muted">
                      {ROLE_LABEL[a.role]}{a.facilityName ? ` · ${a.facilityName}` : ''} &middot; <span className="font-mono">{a.username}</span>
                    </span>
                  </span>
                </span>
                <span className="text-right text-[13px] text-ink-muted">
                  <span className="block">Signed in {fmtStamp(a.signedInAt)}</span>
                  <span className="block text-ink-faint">Last active {fmtAgo(a.lastSeenAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mb-8">
        <Card title={`Record updates from clinicians & nurses${pending ? ` (${pending} awaiting clinic review)` : ''}`}>
          {updates.error && <ErrorBox>{updates.error}</ErrorBox>}
          {updates.data && <UpdatesList updates={updates.data.slice(0, 15)} showClinic />}
        </Card>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-bold">Latest activity</h3>
        <Link to="/admin/audit" className="text-[13px] font-semibold text-teal hover:underline">Full audit log &rarr;</Link>
      </div>
      {recent.error && <ErrorBox>{recent.error}</ErrorBox>}
      {recent.data && <AuditTable rows={recent.data.slice(0, 10)} />}
    </div>
  );
}
