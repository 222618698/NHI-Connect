import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Card, ErrorBox, Field, inputCls, primaryBtn, secondaryBtn } from '../components/ui';
import { fmtShort } from '../format';
import { useLoad } from '../useLoad';

/** REQ-006: record or lift a patient's consent restriction, at the patient's request, from their clinic. */
export default function ConsentCard({ patientId }: { patientId: string }) {
  const { user } = useAuth();
  const restrictions = useLoad(() => api.consentList(patientId), [patientId]);
  const facilities = useLoad(api.clinicFacilities);
  const [scope, setScope] = useState('ALL');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return setError("Record the patient's request or reason.");
    setBusy(true);
    setError(null);
    try {
      await api.consentAdd(patientId, scope === 'ALL' ? null : scope, reason.trim());
      setReason('');
      restrictions.reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const lift = async (id: string) => {
    setError(null);
    try {
      await api.consentLift(patientId, id);
      restrictions.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const active = restrictions.data ?? [];
  return (
    <Card title="Patient consent">
      {active.length === 0 ? (
        <p className="mb-4 text-sm text-ink-muted">No restrictions: every connected facility can view this record.</p>
      ) : (
        <ul className="mb-4 flex flex-col gap-2">
          {active.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E3B3B3] bg-[#FDF3F3] px-3.5 py-2.5 text-[13px]">
              <span>
                <b>Hidden from {r.excludedFacilityName ?? 'all other facilities'}</b>
                <span className="block text-ink-muted">
                  &ldquo;{r.reason}&rdquo; &middot; recorded at {r.ownerFacilityName} by {r.createdBy}, {fmtShort(r.createdAt)}
                </span>
              </span>
              {r.ownerFacilityId === user?.facilityId && (
                <button onClick={() => lift(r.id)} className={secondaryBtn + ' !px-3 !py-1.5 text-xs'}>Lift</button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
        <Field label="Restrict access" htmlFor="cs-scope">
          <select id="cs-scope" value={scope} onChange={(e) => setScope(e.target.value)} className={inputCls}>
            <option value="ALL">Hide from all other facilities</option>
            {facilities.data?.filter((f) => f.id !== user?.facilityId).map((f) => <option key={f.id} value={f.id}>Hide from {f.name}</option>)}
          </select>
        </Field>
        <Field label="Patient's request / reason" htmlFor="cs-reason">
          <input id="cs-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={inputCls}
            placeholder="e.g. Patient asked that HIV care stay private to this clinic" />
        </Field>
        <button type="submit" disabled={busy} className={primaryBtn}>{busy ? 'Saving…' : 'Add restriction'}</button>
      </form>
      {error && <div className="mt-3"><ErrorBox>{error}</ErrorBox></div>}
      <p className="mt-3 text-xs text-ink-faint">Clinicians elsewhere can still use logged break-glass access in an emergency; every use is reviewed by an administrator.</p>
    </Card>
  );
}
