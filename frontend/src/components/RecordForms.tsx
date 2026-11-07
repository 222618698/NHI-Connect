import { useRef, useState, type FormEvent } from 'react';
import { api } from '../api';
import { todayIso } from '../format';
import type { EncounterType, EntryType, NewEntry } from '../types';
import { ErrorBox, Field, SuccessBox, inputCls, primaryBtn } from './ui';

/** Forms for adding to a patient's record. Used by clinic staff and by clinicians/nurses. */

const ENTRY_TYPES: { value: EntryType; label: string; titleHint: string; detailLabel: string; detailHint: string }[] = [
  { value: 'LAB', label: 'Lab result', titleHint: 'e.g. Full Blood Count', detailLabel: 'Result', detailHint: 'e.g. Hb 13.2 g/dL, WCC 6.1 x10⁹/L — within normal limits' },
  { value: 'ENCOUNTER', label: 'Visit', titleHint: 'e.g. Outpatient Consultation — Chest Pain', detailLabel: 'Clinical notes', detailHint: '' },
  { value: 'MEDICATION', label: 'Medication', titleHint: 'e.g. Amlodipine 5mg', detailLabel: 'Dosage & instructions', detailHint: 'e.g. Once daily, oral' },
];

const VISIT_TYPES: { value: EncounterType; label: string }[] = [
  { value: 'OUTPATIENT', label: 'Outpatient' },
  { value: 'EMERGENCY', label: 'Emergency' },
  { value: 'ADMISSION', label: 'Admission' },
  { value: 'FOLLOW_UP', label: 'Follow-up' },
  { value: 'ANTENATAL', label: 'Antenatal' },
];

interface FormProps {
  patientId: string;
  onSaved: () => void;
  /** Text after a successful save, e.g. "Sent to Braamfontein General Hospital for review." */
  savedNote?: string;
}

export function AddEntryForm({ patientId, onSaved, savedNote }: FormProps) {
  const blank: NewEntry = { type: 'LAB', date: todayIso(), encounterType: 'OUTPATIENT', title: '', detail: '' };
  const [e, setE] = useState<NewEntry>(blank);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const meta = ENTRY_TYPES.find((t) => t.value === e.type)!;

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!e.title.trim()) return setError('Enter a title.');
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      await api.addEntry(patientId, { ...e, encounterType: e.type === 'ENCOUNTER' ? e.encounterType : null });
      setSaved(`${meta.label} saved to the patient's record.${savedNote ? ` ${savedNote}` : ''}`);
      setE({ ...blank, type: e.type, date: e.date });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="What are you adding?">
        {ENTRY_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={e.type === t.value}
            onClick={() => { setE((x) => ({ ...x, type: t.value })); setSaved(null); }}
            className={'rounded-lg border py-2 text-[13px] font-semibold ' + (e.type === t.value ? 'border-teal bg-teal text-white' : 'border-[#D6DFE6] text-ink-muted hover:border-teal')}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={e.type === 'MEDICATION' ? 'Start date' : e.type === 'LAB' ? 'Date of test' : 'Date'} htmlFor={`edate-${patientId}`}>
          <input id={`edate-${patientId}`} type="date" max={todayIso()} value={e.date} onChange={(x) => setE((y) => ({ ...y, date: x.target.value }))} className={inputCls} />
        </Field>
        {e.type === 'ENCOUNTER' && (
          <Field label="Visit type" htmlFor={`evtype-${patientId}`}>
            <select id={`evtype-${patientId}`} value={e.encounterType ?? 'OUTPATIENT'} onChange={(x) => setE((y) => ({ ...y, encounterType: x.target.value as EncounterType }))} className={inputCls}>
              {VISIT_TYPES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </Field>
        )}
      </div>
      <Field label={e.type === 'LAB' ? 'Test' : 'Title'} htmlFor={`etitle-${patientId}`}>
        <input id={`etitle-${patientId}`} value={e.title} onChange={(x) => setE((y) => ({ ...y, title: x.target.value }))} placeholder={meta.titleHint} className={inputCls} maxLength={200} />
      </Field>
      <Field label={meta.detailLabel} htmlFor={`edetail-${patientId}`}>
        <textarea id={`edetail-${patientId}`} rows={4} value={e.detail} placeholder={meta.detailHint} onChange={(x) => setE((y) => ({ ...y, detail: x.target.value }))} className={inputCls} maxLength={4000} />
      </Field>
      {error && <ErrorBox>{error}</ErrorBox>}
      {saved && <SuccessBox>{saved}</SuccessBox>}
      <div><button type="submit" disabled={busy} className={primaryBtn}>{busy ? 'Saving…' : `Save ${meta.label}`}</button></div>
    </form>
  );
}

export function UploadForm({ patientId, onSaved, savedNote }: FormProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!file) return setError('Choose a file.');
    if (file.size > 10 * 1024 * 1024) return setError('Files must be 10 MB or smaller.');
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const doc = await api.uploadDocument(patientId, file, description.trim());
      setSaved(`Uploaded ${doc.fileName}.${savedNote ? ` ${savedNote}` : ''}`);
      setFile(null);
      setDescription('');
      if (fileRef.current) fileRef.current.value = '';
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="File (PDF, PNG, JPEG or text, up to 10 MB)" htmlFor={`dfile-${patientId}`}>
        <input
          id={`dfile-${patientId}`}
          ref={fileRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain"
          onChange={(x) => setFile(x.target.files?.[0] ?? null)}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-teal-tint file:px-4 file:py-2 file:text-sm file:font-semibold file:text-teal hover:file:bg-[#D2EFEC]"
        />
      </Field>
      <Field label="Description (optional)" htmlFor={`ddesc-${patientId}`}>
        <input id={`ddesc-${patientId}`} value={description} onChange={(x) => setDescription(x.target.value)} placeholder="e.g. Lab report from NHLS" className={inputCls} maxLength={300} />
      </Field>
      {error && <ErrorBox>{error}</ErrorBox>}
      {saved && <SuccessBox>{saved}</SuccessBox>}
      <div><button type="submit" disabled={busy || !file} className={primaryBtn}>{busy ? 'Uploading…' : 'Upload Document'}</button></div>
    </form>
  );
}
