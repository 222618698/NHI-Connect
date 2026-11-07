import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import Badge from '../components/Badge';
import MappingTable from './MappingTable';
import {
  CONNECTION_TYPES, PROVINCES, sampleCodesFor, useAdminData,
  type ConnectionType, type Facility, type FacilityStatus,
} from './data';

const STEPS = ['Register', 'Connection', 'Field Mapping', 'Code Mapping', 'Test', 'Activate'];

const STATUS_TONE: Record<FacilityStatus, 'good' | 'warn'> = { Active: 'good', Testing: 'warn', Draft: 'warn' };

const FIELD_ROWS = [
  { source: 'PAT_ID_NO', target: 'Patient.identifier (SA ID)' },
  { source: 'PAT_SURNAME', target: 'Patient.name.family' },
  { source: 'PAT_FIRSTNAMES', target: 'Patient.name.given' },
  { source: 'PAT_DOB', target: 'Patient.birthDate' },
  { source: 'ADM_DATE', target: 'Encounter.period.start' },
  { source: 'DIAG_CODE', target: 'Condition.code' },
  { source: 'RX_ITEM', target: 'MedicationStatement.medication' },
  { source: 'LAB_TEST', target: 'Observation.code' },
];
const FHIR_TARGETS = [...FIELD_ROWS.map((r) => r.target), 'Observation.value', '(ignore)'];

const input = 'w-full rounded-lg border border-[#D6DFE6] bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-teal';
const label = 'mb-1.5 mt-5 block text-[13px] font-semibold text-ink-soft first:mt-0';
const primaryBtn = 'rounded-lg bg-teal px-6 py-3 text-[15px] font-semibold text-white hover:bg-teal-dark disabled:cursor-not-allowed disabled:opacity-50';
const secondaryBtn = 'rounded-lg border border-[#D6DFE6] bg-white px-5 py-3 text-[15px] font-semibold text-ink-muted hover:bg-canvas';

function Stepper({ step }: { step: number }) {
  return (
    <ol className="mb-8 flex overflow-x-auto pb-1">
      {STEPS.map((name, i) => {
        const n = i + 1;
        const done = n < step;
        const current = n === step;
        return (
          <li key={name} className="flex min-w-[110px] flex-1 flex-col items-start">
            <div className="flex w-full items-center">
              <span
                className={
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold ' +
                  (current ? 'border-teal bg-teal text-white' : done ? 'border-teal bg-white text-teal' : 'border-line bg-white text-ink-faint')
                }
              >
                {done ? '✓' : n}
              </span>
              {n < STEPS.length && <span className={'mx-3 h-0.5 flex-1 ' + (done ? 'bg-teal' : 'bg-line')} />}
            </div>
            <span className={'mt-2 text-[13px] font-semibold ' + (current || done ? 'text-teal' : 'text-ink-muted')}>{name}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-8">
      <h3 className="mb-5 text-base font-bold">{title}</h3>
      {children}
    </section>
  );
}

function Nav({ onBack, children }: { onBack?: () => void; children: ReactNode }) {
  return (
    <div className="mt-7 flex flex-wrap gap-3">
      {onBack && <button type="button" onClick={onBack} className={secondaryBtn}>&larr; Back</button>}
      {children}
    </div>
  );
}

export default function OnboardingPage() {
  const username = useAuth().user?.fullName;
  const { facilities, mappings, addFacility, setFacilityStatus, setMapping, seedCodes, log } = useAdminData();

  const [step, setStep] = useState(1);
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const facility = facilities.find((f) => f.id === facilityId) ?? null;
  const codes = facilityId ? mappings[facilityId] ?? [] : [];
  const pending = codes.filter((c) => !c.standardCode).length;

  // Step 1 form
  const [name, setName] = useState('');
  const [province, setProvince] = useState('');
  const [connType, setConnType] = useState<ConnectionType>('Database Connection');
  const [formError, setFormError] = useState<string | null>(null);

  // Step 2 / 5 progress
  const [connTested, setConnTested] = useState(false);
  const [testRun, setTestRun] = useState(false);
  const [fields, setFields] = useState(() => Object.fromEntries(FIELD_ROWS.map((r) => [r.source, r.target])));

  const audit = (eventType: string, target: string) =>
    log({ user: username ?? 'Admin', role: 'System Admin', hospital: facility?.shortName ?? null, eventType, target, outcome: 'Success' });

  // A facility "sends" its local codes once we reach code mapping.
  useEffect(() => {
    if (step === 4 && facility) seedCodes(facility.id, sampleCodesFor(facility.shortName.slice(0, 3).toUpperCase()));
  }, [step, facility]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => {
    setStep(1); setFacilityId(null); setName(''); setProvince(''); setConnType('Database Connection');
    setConnTested(false); setTestRun(false); setFormError(null);
  };

  const resume = (f: Facility) => {
    if (f.status === 'Active') return;
    setFacilityId(f.id);
    setConnTested(f.status === 'Testing');
    setTestRun(f.status === 'Testing');
    setStep(f.status === 'Testing' ? 5 : 2);
  };

  const register = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setFormError('Enter the facility name.');
    if (!province) return setFormError('Choose a province.');
    if (facilities.some((f) => f.name.toLowerCase() === name.trim().toLowerCase())) return setFormError('A facility with this name is already registered.');
    const f = addFacility({ name: name.trim(), province, connectionType: connType });
    log({ user: username ?? 'Admin', role: 'System Admin', hospital: f.shortName, eventType: 'Facility Registered', target: f.name, outcome: 'Success' });
    setFacilityId(f.id);
    setFormError(null);
    setStep(2);
  };

  const runTest = () => {
    if (!facility) return;
    setFacilityStatus(facility.id, 'Testing');
    audit('Test Extract', `${facility.name} — test extract`);
    setTestRun(true);
  };

  const activate = () => {
    if (!facility) return;
    setFacilityStatus(facility.id, 'Active');
    audit('Facility Activated', facility.name);
    setStep(7);
  };

  let body: ReactNode;
  if (step === 1 || !facility) {
    body = (
      <Card title="Facility Details">
        <form onSubmit={register}>
          <label htmlFor="fname" className={label}>Facility Name</label>
          <input id="fname" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Riverbend Provincial Hospital" className={input} />
          <label htmlFor="prov" className={label}>Province</label>
          <select id="prov" value={province} onChange={(e) => setProvince(e.target.value)} className={input}>
            <option value="" disabled>Select a province</option>
            {PROVINCES.map((p) => <option key={p}>{p}</option>)}
          </select>
          <label htmlFor="ctype" className={label}>Connection Type</label>
          <select id="ctype" value={connType} onChange={(e) => setConnType(e.target.value as ConnectionType)} className={input}>
            {CONNECTION_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          {formError && <p className="mt-4 rounded-lg border border-[#F0C9C9] bg-[#FBE7E7] px-4 py-2.5 text-[13px] text-[#9C3B3B]">{formError}</p>}
          <Nav><button type="submit" className={primaryBtn}>Register &amp; Configure Connection &rarr;</button></Nav>
        </form>
      </Card>
    );
  } else if (step === 2) {
    const t = facility.connectionType;
    body = (
      <Card title={`Connection — ${t}`}>
        {t === 'Database Connection' && (
          <>
            <label className={label}>Database Host</label><input className={input} defaultValue={`db.${facility.id}.health.gov.za`} />
            <label className={label}>Database Name</label><input className={input} defaultValue="his_prod" />
            <label className={label}>Nightly Extract Time</label><input type="time" className={input} defaultValue="02:00" />
          </>
        )}
        {t === 'File Extract' && (
          <>
            <label className={label}>Secure Upload Folder</label><input className={input} defaultValue={`sftp://upload.nhi-connect.gov.za/${facility.id}/`} />
            <label className={label}>File Format</label>
            <select className={input} defaultValue="CSV"><option>CSV</option><option>HL7 v2 batch</option><option>FHIR NDJSON</option></select>
          </>
        )}
        {t === 'Message Endpoint' && (
          <>
            <label className={label}>Endpoint URL</label><input className={input} defaultValue={`https://${facility.id}.health.gov.za/fhir`} />
            <label className={label}>Message Standard</label>
            <select className={input} defaultValue="FHIR R4"><option>FHIR R4</option><option>HL7 v2.5</option></select>
          </>
        )}
        {connTested && <p className="mt-5 rounded-lg bg-teal-tint px-4 py-2.5 text-[13px] font-semibold text-teal">&#10003; Connection successful</p>}
        <Nav onBack={() => setStep(1)}>
          {!connTested ? (
            <button type="button" className={primaryBtn} onClick={() => { setConnTested(true); audit('Connection Test', facility.name); }}>Test Connection</button>
          ) : (
            <button type="button" className={primaryBtn} onClick={() => setStep(3)}>Continue to Field Mapping &rarr;</button>
          )}
        </Nav>
      </Card>
    );
  } else if (step === 3) {
    body = (
      <Card title="Field Mapping">
        <p className="mb-4 text-sm text-ink-muted">Match each field in {facility.shortName}&apos;s system to the standard FHIR field.</p>
        <div className="flex flex-col gap-2.5">
          {FIELD_ROWS.map((r) => (
            <div key={r.source} className="grid grid-cols-[1fr_auto_1.4fr] items-center gap-3">
              <code className="truncate rounded-md bg-canvas px-2.5 py-2 text-[13px]">{r.source}</code>
              <span className="text-ink-faint">&rarr;</span>
              <select
                value={fields[r.source]}
                onChange={(e) => setFields((f) => ({ ...f, [r.source]: e.target.value }))}
                className="min-w-0 rounded-md border border-[#D6DFE6] bg-white px-2.5 py-2 text-[13px] outline-none focus:border-teal"
                aria-label={`FHIR field for ${r.source}`}
              >
                {FHIR_TARGETS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          ))}
        </div>
        <Nav onBack={() => setStep(2)}>
          <button type="button" className={primaryBtn} onClick={() => { audit('Field Mapping Saved', facility.name); setStep(4); }}>Continue to Code Mapping &rarr;</button>
        </Nav>
      </Card>
    );
  } else if (step === 4) {
    body = (
      <Card title="Code Mapping">
        <p className="mb-4 text-sm text-ink-muted">
          Map {facility.shortName}&apos;s local codes to standard codes. {pending > 0 ? `${pending} still pending.` : 'All codes mapped.'}
        </p>
        <MappingTable
          rows={codes}
          onMap={(code, std) => { setMapping(facility.id, code, std); audit('Mapping Change', `${code} → ${std}`); }}
        />
        <Nav onBack={() => setStep(3)}>
          <button type="button" className={primaryBtn} onClick={() => setStep(5)}>Continue to Test &rarr;</button>
        </Nav>
      </Card>
    );
  } else if (step === 5) {
    body = (
      <Card title="Test Extract">
        <p className="text-sm text-ink-muted">Pull a sample of records from {facility.name} and check they convert cleanly.</p>
        {testRun && (
          <dl className="mt-5 grid grid-cols-3 gap-3">
            {[
              ['Records received', '1,284'],
              ['Converted', pending ? '1,251' : '1,284'],
              ['Unmapped codes', String(pending)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-line bg-canvas p-4">
                <dt className="text-xs text-ink-muted">{k}</dt>
                <dd className={'mt-1 text-xl font-bold ' + (k === 'Unmapped codes' && pending ? 'text-[#B07A12]' : '')}>{v}</dd>
              </div>
            ))}
          </dl>
        )}
        <Nav onBack={() => setStep(4)}>
          <button type="button" className={testRun ? secondaryBtn : primaryBtn} onClick={runTest}>{testRun ? 'Run Again' : 'Run Test Extract'}</button>
          {testRun && <button type="button" className={primaryBtn} onClick={() => setStep(6)}>Continue to Activate &rarr;</button>}
        </Nav>
      </Card>
    );
  } else if (step === 6) {
    body = (
      <Card title="Activate Facility">
        {pending > 0 ? (
          <p className="rounded-lg border border-amber-line bg-amber-tint px-4 py-3 text-sm text-amber-ink">
            {pending} local code{pending > 1 ? 's are' : ' is'} still unmapped. Map {pending > 1 ? 'them' : 'it'} before activating, so
            clinicians don&apos;t see incomplete records. <button className="font-semibold underline" onClick={() => setStep(4)}>Go to Code Mapping</button>
          </p>
        ) : (
          <p className="text-sm text-ink-muted">
            Everything checks out. Activating makes {facility.name}&apos;s records visible to clinicians across the network.
          </p>
        )}
        <Nav onBack={() => setStep(5)}>
          <button type="button" className={primaryBtn} disabled={pending > 0} onClick={activate}>Activate Facility</button>
        </Nav>
      </Card>
    );
  } else {
    body = (
      <Card title="Facility Activated">
        <p className="text-sm text-ink-muted">{facility.name} is now live on NHI-Connect.</p>
        <Nav>
          <button type="button" className={primaryBtn} onClick={reset}>Onboard Another Hospital</button>
          <Link to="/admin/audit" className={secondaryBtn}>View Audit Log</Link>
        </Nav>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-[1180px]">
      <h2 className="mb-1 text-[26px] font-bold">Onboard a New Hospital</h2>
      <p className="mb-8 text-[15px] text-ink-muted">Register a facility, then configure its connection and mappings before activation.</p>

      <Stepper step={Math.min(step, 7)} />

      <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr]">
        <div>{body}</div>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-bold">Connected Facilities</h3>
            {step !== 1 && <button onClick={reset} className="text-[13px] font-semibold text-teal hover:underline">+ New hospital</button>}
          </div>
          <div className="flex flex-col gap-2.5">
            {facilities.map((f) => {
              const selected = f.id === facilityId;
              const clickable = f.status !== 'Active';
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => resume(f)}
                  disabled={!clickable}
                  title={clickable ? 'Continue onboarding' : undefined}
                  className={
                    'flex items-center justify-between gap-3 rounded-xl border bg-white px-5 py-4 text-left ' +
                    (selected ? 'border-teal' : 'border-line') + (clickable ? ' hover:border-teal' : ' cursor-default')
                  }
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-bold">{f.name}</span>
                    <span className="block text-[13px] text-ink-muted">{f.province} &middot; {f.connectionType}</span>
                  </span>
                  <Badge tone={STATUS_TONE[f.status]}>{f.status}</Badge>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-ink-faint">Select a facility that isn&apos;t active yet to continue its onboarding.</p>
        </section>
      </div>
    </div>
  );
}
