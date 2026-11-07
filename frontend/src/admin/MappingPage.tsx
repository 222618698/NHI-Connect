import { useState } from 'react';
import { useAuth } from '../auth';
import { useAdminData } from './data';
import MappingTable from './MappingTable';

export default function MappingPage() {
  const username = useAuth().user?.fullName;
  const { facilities, mappings, setMapping, log } = useAdminData();
  const [facilityId, setFacilityId] = useState(() => facilities.find((f) => f.status !== 'Active')?.id ?? facilities[0]?.id ?? '');
  const facility = facilities.find((f) => f.id === facilityId);
  const rows = mappings[facilityId] ?? [];
  const pending = rows.filter((r) => !r.standardCode).length;

  const onMap = (localCode: string, standardCode: string) => {
    setMapping(facilityId, localCode, standardCode);
    log({
      user: username ?? 'Admin', role: 'System Admin', hospital: facility?.shortName ?? null,
      eventType: 'Mapping Change', target: `${localCode} → ${standardCode}`, outcome: 'Success',
    });
  };

  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="mb-1 text-[26px] font-bold">Data Mapping</h2>
          <p className="text-[15px] text-ink-muted">Map local codes to standard FHIR terminology for a facility.</p>
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm">
          <span className="text-ink-muted">Facility:</span>
          <select value={facilityId} onChange={(e) => setFacilityId(e.target.value)} className="bg-transparent font-bold outline-none">
            {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
      </div>

      {rows.length > 0 && (
        <p className="mb-3 text-sm text-ink-muted">
          {rows.length - pending} of {rows.length} codes mapped
          {pending > 0 && <span className="font-semibold text-[#B07A12]"> &middot; {pending} pending</span>}
        </p>
      )}
      <MappingTable rows={rows} onMap={onMap} />
    </div>
  );
}
