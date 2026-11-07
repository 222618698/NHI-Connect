import { useState } from 'react';
import { api } from '../api';
import AuditTable from '../components/AuditTable';
import { ErrorBox, PageHeading, secondaryBtn } from '../components/ui';
import { EVENT_LABEL } from '../format';
import { useLoad } from '../useLoad';

const OUTCOMES = [['', 'All outcomes'], ['SUCCESS', 'Success'], ['FLAGGED', 'Flagged'], ['FAILED', 'Failed']] as const;

export default function AuditLogPage() {
  const [facilityId, setFacilityId] = useState('');
  const [eventType, setEventType] = useState('');
  const [outcome, setOutcome] = useState('');

  const facilities = useLoad(api.listFacilities);
  const log = useLoad(() => api.audit({ facilityId, eventType, outcome }), [facilityId, eventType, outcome]);

  const select = 'rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-teal';

  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeading title="Audit Log" sub="Every sign-in, every look at patient data, and every change, across the network.">
        <button onClick={log.reload} className={secondaryBtn}>Refresh</button>
      </PageHeading>

      <div className="mb-4 flex flex-wrap gap-2.5">
        <select aria-label="Clinic" value={facilityId} onChange={(e) => setFacilityId(e.target.value)} className={select}>
          <option value="">All clinics</option>
          {facilities.data?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select aria-label="Event type" value={eventType} onChange={(e) => setEventType(e.target.value)} className={select}>
          <option value="">All events</option>
          {Object.entries(EVENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select aria-label="Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} className={select}>
          {OUTCOMES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {log.error && <ErrorBox>{log.error}</ErrorBox>}
      {log.loading && !log.data && <p className="text-sm text-ink-faint">Loading&hellip;</p>}
      {log.data && <AuditTable rows={log.data} empty="No events match these filters." />}
      {log.data && log.data.length >= 300 && <p className="mt-3 text-xs text-ink-faint">Showing the latest 300 events. Narrow the filters to see older ones.</p>}
    </div>
  );
}
