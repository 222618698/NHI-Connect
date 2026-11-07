import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, NotFoundError } from '../api';
import { Card, ErrorBox, Field, PageHeading, inputCls, primaryBtn, secondaryBtn } from '../components/ui';
import { fmtShort } from '../format';
import type { NewPatient } from '../types';
import { useLoad } from '../useLoad';

const EMPTY: NewPatient = { nationalId: '', firstName: '', surname: '', dateOfBirth: '', sex: '', localPatientId: '' };

/** SA ID = YYMMDD SSSS C A Z. Reads the date of birth and sex out of a full 13-digit number. */
function fromIdNumber(id: string): Partial<NewPatient> {
  if (!/^\d{13}$/.test(id)) return {};
  const yy = Number(id.slice(0, 2));
  const century = yy > new Date().getFullYear() % 100 ? 1900 : 2000;
  const dob = `${century + yy}-${id.slice(2, 4)}-${id.slice(4, 6)}`;
  const valid = !Number.isNaN(new Date(dob).getTime());
  return { ...(valid ? { dateOfBirth: dob } : {}), sex: Number(id.slice(6, 10)) >= 5000 ? 'Male' : 'Female' };
}

function AddPatientForm({ onDone }: { onDone: (patientId: string, existed: boolean) => void }) {
  const [p, setP] = useState<NewPatient>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof NewPatient>(k: K, v: NewPatient[K]) => setP((x) => ({ ...x, [k]: v }));

  const onId = (raw: string) => {
    const id = raw.replace(/\D/g, '').slice(0, 13);
    setP((x) => ({ ...x, nationalId: id, ...fromIdNumber(id) }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{13}$/.test(p.nationalId)) return setError('Enter a 13-digit South African ID number.');
    if (!p.firstName.trim() || !p.surname.trim()) return setError('Enter the first name and surname.');
    if (!p.dateOfBirth || !p.sex) return setError('Enter the date of birth and sex.');
    setBusy(true);
    setError(null);
    try {
      const r = await api.addPatient(p);
      onDone(r.patient.patientId, r.alreadyOnNationalRecord);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="SA ID number" htmlFor="pid">
        <input id="pid" value={p.nationalId} onChange={(e) => onId(e.target.value)} inputMode="numeric" placeholder="13 digits" className={inputCls + ' font-mono tracking-wide'} />
      </Field>
      <Field label="Clinic file number (optional)" htmlFor="plocal">
        <input id="plocal" value={p.localPatientId} onChange={(e) => set('localPatientId', e.target.value)} placeholder="e.g. BGH-010233" className={inputCls} />
      </Field>
      <Field label="First name(s)" htmlFor="pfirst">
        <input id="pfirst" value={p.firstName} onChange={(e) => set('firstName', e.target.value)} className={inputCls} />
      </Field>
      <Field label="Surname" htmlFor="psur">
        <input id="psur" value={p.surname} onChange={(e) => set('surname', e.target.value)} className={inputCls} />
      </Field>
      <Field label="Date of birth" htmlFor="pdob">
        <input id="pdob" type="date" value={p.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} className={inputCls} />
      </Field>
      <Field label="Sex" htmlFor="psex">
        <select id="psex" value={p.sex} onChange={(e) => set('sex', e.target.value as NewPatient['sex'])} className={inputCls}>
          <option value="" disabled>Select</option>
          <option>Female</option>
          <option>Male</option>
        </select>
      </Field>
      <p className="text-xs text-ink-faint sm:col-span-2">
        Date of birth and sex fill in from the ID number. If this ID is already on the national record, the existing patient is linked to your clinic instead of creating a duplicate.
      </p>
      {error && <div className="sm:col-span-2"><ErrorBox>{error}</ErrorBox></div>}
      <div className="sm:col-span-2"><button type="submit" disabled={busy} className={primaryBtn}>{busy ? 'Saving…' : 'Add Patient'}</button></div>
    </form>
  );
}

export default function ClinicPatientsPage() {
  const navigate = useNavigate();
  const patients = useLoad(api.clinicPatients);
  const [filter, setFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [lookupId, setLookupId] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);

  const lookup = async (e: FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    if (!/^\d{13}$/.test(lookupId)) return setLookupError('Enter a 13-digit SA ID number.');
    try {
      const p = await api.searchById(lookupId);
      navigate(`/clinic/patients/${p.patientId}`);
    } catch (err) {
      if (err instanceof NotFoundError) {
        setLookupError('Not on the national record yet. Add them as a new patient below.');
        setShowAdd(true);
      } else setLookupError((err as Error).message);
    }
  };

  const q = filter.trim().toLowerCase();
  const rows = (patients.data ?? []).filter((p) => !q || p.fullName.toLowerCase().includes(q) || p.nationalId.includes(q) || p.localPatientId.toLowerCase().includes(q));

  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeading title="Patients" sub="Patients seen at this clinic. Add someone whose records couldn't be fetched, then record their visits and upload their files.">
        <button onClick={() => setShowAdd((s) => !s)} className={primaryBtn}>{showAdd ? 'Close' : '+ Add Patient'}</button>
      </PageHeading>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <Card title="Find on the national record">
          <form onSubmit={lookup} className="flex gap-2.5">
            <input
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value.replace(/\D/g, '').slice(0, 13))}
              inputMode="numeric"
              placeholder="SA ID number"
              aria-label="SA ID number"
              className={inputCls + ' font-mono tracking-wide'}
            />
            <button type="submit" className={secondaryBtn}>Search</button>
          </form>
          {lookupError && <p className="mt-3 text-[13px] text-[#9C3B3B]">{lookupError}</p>}
          <p className="mt-3 text-xs text-ink-faint">Opening a patient found here and adding a visit links them to your clinic automatically.</p>
        </Card>

        {showAdd && (
          <Card title="Add a new patient">
            <AddPatientForm onDone={(id) => navigate(`/clinic/patients/${id}`)} />
          </Card>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-bold">At this clinic ({patients.data?.length ?? 0})</h3>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by name, ID or file no." aria-label="Filter patients" className={inputCls + ' max-w-[280px]'} />
      </div>
      {patients.error && <ErrorBox>{patients.error}</ErrorBox>}
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-line">
            <tr>
              {['Name', 'SA ID', 'File no.', 'Date of birth', 'Sex', 'Documents', ''].map((h) => (
                <th key={h} className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-ink-faint">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.patientId} className="border-b border-line last:border-0 hover:bg-canvas">
                <td className="px-5 py-4 font-bold"><Link to={`/clinic/patients/${p.patientId}`} className="hover:text-teal">{p.fullName}</Link></td>
                <td className="px-5 py-4 font-mono text-ink-soft">{p.nationalId}</td>
                <td className="px-5 py-4 text-ink-muted">{p.localPatientId}</td>
                <td className="px-5 py-4 text-ink-muted">{fmtShort(p.dateOfBirth)}</td>
                <td className="px-5 py-4 text-ink-muted">{p.sex}</td>
                <td className="px-5 py-4 text-ink-muted">{p.documentCount}</td>
                <td className="px-5 py-4 text-right"><Link to={`/clinic/patients/${p.patientId}`} className="text-[13px] font-semibold text-teal hover:underline">Open &rarr;</Link></td>
              </tr>
            ))}
            {patients.data && rows.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-ink-muted">{q ? 'No patients match that filter.' : 'No patients linked to this clinic yet.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
