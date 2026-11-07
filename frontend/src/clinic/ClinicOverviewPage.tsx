import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import AuditTable from '../components/AuditTable';
import Badge from '../components/Badge';
import UpdatesList from '../components/UpdatesList';
import { Card, ErrorBox, PageHeading, StatTile, primaryBtn, secondaryBtn } from '../components/ui';
import { ROLE_LABEL, fmtAgo } from '../format';
import type { RecordUpdate } from '../types';
import { useLoad } from '../useLoad';

export default function ClinicOverviewPage() {
  const { data, error, reload } = useLoad(api.clinicOverview);
  const updates = useLoad(api.clinicUpdates);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const refresh = () => { reload(); updates.reload(); };

  const review = async (u: RecordUpdate) => {
    setReviewError(null);
    try {
      await api.reviewUpdate(u.id);
      refresh();
    } catch (e) {
      setReviewError((e as Error).message);
    }
  };

  const pending = updates.data?.filter((u) => !u.reviewedAt).length ?? 0;

  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeading title={data?.facility.name ?? 'Clinic'} sub={data ? `${data.facility.province} · staff, sign-ins, updates and activity at this clinic` : undefined}>
        <span className="flex gap-2.5">
          <button onClick={refresh} className={secondaryBtn}>Refresh</button>
          <Link to="/clinic/patients" className={primaryBtn}>Patients &rarr;</Link>
        </span>
      </PageHeading>

      {error && <ErrorBox>{error}</ErrorBox>}

      {data && (
        <>
          <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Updates awaiting review" value={pending} tone={pending ? 'warn' : undefined} />
            <StatTile label="Patients at this clinic" value={data.stats.patients} />
            <StatTile label="Record entries added this month" value={data.stats.entriesAddedThisMonth} />
            <StatTile label="Documents uploaded" value={data.stats.documents} />
          </div>

          <div className="mb-8">
            <Card title={`Updates from clinicians & nurses${pending ? ` (${pending} to review)` : ''}`}>
              <p className="-mt-2 mb-3 text-[13px] text-ink-muted">Lab results, visits, medications and documents your clinicians and nurses added to patient records.</p>
              {reviewError && <ErrorBox>{reviewError}</ErrorBox>}
              {updates.error && <ErrorBox>{updates.error}</ErrorBox>}
              {updates.data && <UpdatesList updates={updates.data} onReview={review} />}
            </Card>
          </div>

          <div className="mb-8">
            <Card title="Staff at this clinic">
              <ul className="divide-y divide-line">
                {data.staff.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <span>
                      <span className={'block text-[15px] font-semibold ' + (s.active ? '' : 'text-ink-faint line-through')}>{s.fullName}</span>
                      <span className="block text-[13px] text-ink-muted">
                        <span className="font-mono">{s.username}</span> &middot; {ROLE_LABEL[s.role]} &middot; last sign-in {fmtAgo(s.lastLoginAt)}
                      </span>
                    </span>
                    {s.signedInNow ? <Badge tone="good">Signed in now</Badge> : <span className="text-[13px] text-ink-faint">Signed out</span>}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-ink-faint">To add or remove staff accounts, contact your NHI-Connect administrator.</p>
            </Card>
          </div>

          <h3 className="mb-3 text-base font-bold">Recent activity at this clinic</h3>
          <AuditTable rows={data.recentActivity} showHospital={false} />
        </>
      )}
    </div>
  );
}
