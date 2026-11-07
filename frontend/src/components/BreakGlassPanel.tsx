import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { BREAK_GLASS_REASONS } from '../format';
import type { UnifiedRecord } from '../types';
import { ErrorBox, Field, inputCls } from './ui';

/**
 * Shown when a patient's consent restriction blocks the record (REQ-006). A clinician may invoke break-glass
 * with a reason; the record is then shown for this view only and the event is flagged for administrator review.
 */
export default function BreakGlassPanel({ patientId, message, allowed, onGranted }: {
  patientId: string;
  message: string;
  allowed: boolean;
  onGranted: (record: UnifiedRecord) => void;
}) {
  const [reason, setReason] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!reason) return setError('Choose the reason for emergency access.');
    if (text.trim().length < 10) return setError('Describe the emergency (at least 10 characters).');
    setBusy(true);
    setError(null);
    try {
      onGranted(await api.breakGlass(patientId, reason, text.trim()));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border-2 border-[#E3B3B3] bg-white px-7 py-6">
      <h1 className="mb-1 text-[19px] font-bold text-[#9C3B3B]">&#128274; Record restricted by patient consent</h1>
      <p className="mb-4 text-sm text-ink-soft">{message}</p>
      {allowed ? (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Reason for emergency (break-glass) access" htmlFor="bg-reason">
            <select id="bg-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}>
              <option value="" disabled>Select a reason</option>
              {BREAK_GLASS_REASONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
            </select>
          </Field>
          <Field label="Describe the emergency" htmlFor="bg-text">
            <textarea id="bg-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} className={inputCls}
              placeholder="e.g. Patient brought in unconscious after a collision; need medication and allergy history." />
          </Field>
          <p className="text-xs text-ink-muted">
            Your name, facility, reason and the time are logged and sent to an administrator for review. Access applies to this view only.
          </p>
          {error && <ErrorBox>{error}</ErrorBox>}
          <div>
            <button type="submit" disabled={busy} className="rounded-lg bg-[#B23B3B] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#962f2f] disabled:opacity-60">
              {busy ? 'Requesting…' : 'Break glass — view record'}
            </button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-ink-muted">Only clinicians and nurses can request emergency access.</p>
      )}
    </section>
  );
}
