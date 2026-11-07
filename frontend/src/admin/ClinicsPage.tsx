import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import Badge from '../components/Badge';
import { Card, ErrorBox, Field, PageHeading, SuccessBox, inputCls, primaryBtn, secondaryBtn } from '../components/ui';
import { PROVINCES, ROLE_LABEL, fmtAgo } from '../format';
import type { Facility, NewUserAccount, Role, UserAccount } from '../types';
import { useLoad } from '../useLoad';

function AddClinicForm({ onAdded }: { onAdded: (f: Facility) => void }) {
  const [name, setName] = useState('');
  const [province, setProvince] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Enter the clinic name.');
    if (!province) return setError('Choose a province.');
    setBusy(true);
    setError(null);
    try {
      const f = await api.createFacility(name.trim(), province);
      setName('');
      setProvince('');
      onAdded(f);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Clinic name" htmlFor="cname">
        <input id="cname" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Soweto Community Clinic" className={inputCls} />
      </Field>
      <Field label="Province" htmlFor="cprov">
        <select id="cprov" value={province} onChange={(e) => setProvince(e.target.value)} className={inputCls}>
          <option value="" disabled>Select a province</option>
          {PROVINCES.map((p) => <option key={p}>{p}</option>)}
        </select>
      </Field>
      {error && <ErrorBox>{error}</ErrorBox>}
      <div><button type="submit" disabled={busy} className={primaryBtn}>{busy ? 'Adding…' : 'Add Clinic'}</button></div>
    </form>
  );
}

const EMPTY_USER: NewUserAccount = { username: '', fullName: '', password: '', role: 'CLINIC', facilityId: null };

function AddUserForm({ facilities, presetFacility, onAdded }: { facilities: Facility[]; presetFacility: string | null; onAdded: (u: UserAccount) => void }) {
  const [u, setU] = useState<NewUserAccount>({ ...EMPTY_USER, facilityId: presetFacility });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof NewUserAccount>(k: K, v: NewUserAccount[K]) => setU((x) => ({ ...x, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!u.fullName.trim() || !u.username.trim()) return setError('Enter the full name and a username.');
    if (u.password.length < 8) return setError('Passwords must be at least 8 characters.');
    if (u.role !== 'ADMIN' && !u.facilityId) return setError('Choose the clinic this account belongs to.');
    setBusy(true);
    setError(null);
    try {
      const created = await api.createUser({ ...u, facilityId: u.role === 'ADMIN' ? null : u.facilityId });
      setU({ ...EMPTY_USER, facilityId: u.facilityId, role: u.role });
      onAdded(created);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name" htmlFor="ufull">
        <input id="ufull" value={u.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder="e.g. Sr N. Sithole" className={inputCls} />
      </Field>
      <Field label="Username" htmlFor="uname">
        <input id="uname" value={u.username} onChange={(e) => set('username', e.target.value.replace(/\s/g, '').toLowerCase())} placeholder="e.g. n.sithole" className={inputCls} autoComplete="off" />
      </Field>
      <Field label="Account type" htmlFor="urole">
        <select id="urole" value={u.role} onChange={(e) => set('role', e.target.value as Role)} className={inputCls}>
          <option value="CLINIC">Clinic staff (manages a clinic&apos;s patients &amp; files)</option>
          <option value="CLINICIAN">Clinician / Nurse (searches patient records)</option>
          <option value="ADMIN">Administrator</option>
        </select>
      </Field>
      <Field label="Clinic" htmlFor="ufac">
        <select id="ufac" value={u.role === 'ADMIN' ? '' : u.facilityId ?? ''} disabled={u.role === 'ADMIN'} onChange={(e) => set('facilityId', e.target.value || null)} className={inputCls + ' disabled:bg-canvas disabled:text-ink-faint'}>
          <option value="">{u.role === 'ADMIN' ? 'Not needed for administrators' : 'Select a clinic'}</option>
          {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </Field>
      <Field label="Temporary password" htmlFor="upass" className="sm:col-span-2">
        <input id="upass" type="text" value={u.password} onChange={(e) => set('password', e.target.value)} placeholder="At least 8 characters" className={inputCls} autoComplete="new-password" />
        <p className="mt-1.5 text-xs text-ink-faint">Give this to the person securely. You can reset it later.</p>
      </Field>
      {error && <div className="sm:col-span-2"><ErrorBox>{error}</ErrorBox></div>}
      <div className="sm:col-span-2"><button type="submit" disabled={busy} className={primaryBtn}>{busy ? 'Creating…' : 'Create Account'}</button></div>
    </form>
  );
}

export default function ClinicsPage() {
  const { user: me } = useAuth();
  const facilities = useLoad(api.listFacilities);
  const users = useLoad(api.listUsers);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showAddClinic, setShowAddClinic] = useState(false);

  const visibleUsers = (users.data ?? []).filter((u) => !selected || u.facilityId === selected);
  const selectedFacility = facilities.data?.find((f) => f.id === selected) ?? null;

  const toggleActive = async (u: UserAccount) => {
    setActionError(null);
    try {
      await api.setUserActive(u.id, !u.active);
      setMessage(`${u.fullName} ${u.active ? 'disabled — they have been signed out' : 'enabled'}.`);
      users.reload();
    } catch (e) {
      setActionError((e as Error).message);
    }
  };

  const resetPassword = async (u: UserAccount) => {
    const pw = window.prompt(`New temporary password for ${u.fullName} (at least 8 characters):`);
    if (pw === null) return;
    setActionError(null);
    try {
      await api.resetPassword(u.id, pw);
      setMessage(`Password reset for ${u.fullName}. They have been signed out everywhere.`);
    } catch (e) {
      setActionError((e as Error).message);
    }
  };

  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeading title="Clinics & User Accounts" sub="Add a clinic, then create sign-ins for its staff and clinicians.">
        <button onClick={() => setShowAddClinic((s) => !s)} className={primaryBtn}>{showAddClinic ? 'Close' : '+ Add Clinic'}</button>
      </PageHeading>

      {message && <div className="mb-5"><SuccessBox>{message}</SuccessBox></div>}
      {actionError && <div className="mb-5"><ErrorBox>{actionError}</ErrorBox></div>}

      {showAddClinic && (
        <div className="mb-8 max-w-[560px]">
          <Card title="Add a clinic">
            <AddClinicForm onAdded={(f) => {
              setShowAddClinic(false);
              setMessage(`${f.name} added. Now create a clinic staff account for it below.`);
              facilities.reload();
              setSelected(f.id);
            }} />
          </Card>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_1.5fr]">
        <section>
          <h3 className="mb-3 text-base font-bold">Clinics ({facilities.data?.length ?? 0})</h3>
          {facilities.error && <ErrorBox>{facilities.error}</ErrorBox>}
          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => setSelected(null)}
              className={'rounded-xl border bg-white px-5 py-3 text-left text-sm font-semibold ' + (selected === null ? 'border-teal text-teal' : 'border-line text-ink-muted hover:border-teal')}
            >
              All accounts
            </button>
            {facilities.data?.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelected(f.id)}
                className={'flex items-center justify-between gap-3 rounded-xl border bg-white px-5 py-4 text-left ' + (selected === f.id ? 'border-teal' : 'border-line hover:border-teal')}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-bold">{f.name}</span>
                  <span className="block text-[13px] text-ink-muted">{f.province} &middot; {f.patientCount} patients &middot; {f.userCount} accounts</span>
                </span>
                <Badge tone={f.status === 'ACTIVE' ? 'good' : 'warn'}>{f.status === 'ACTIVE' ? 'Active' : f.status}</Badge>
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <Card title={selectedFacility ? `Accounts at ${selectedFacility.name}` : 'All accounts'}>
            {users.error && <ErrorBox>{users.error}</ErrorBox>}
            {users.data && visibleUsers.length === 0 && <p className="text-sm text-ink-muted">No accounts yet. Create one below.</p>}
            <ul className="divide-y divide-line">
              {visibleUsers.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className={'block text-[15px] font-semibold ' + (u.active ? '' : 'text-ink-faint line-through')}>{u.fullName}</span>
                    <span className="block text-[13px] text-ink-muted">
                      <span className="font-mono">{u.username}</span> &middot; {ROLE_LABEL[u.role]}
                      {!selected && u.facilityName ? ` · ${u.facilityName}` : ''} &middot; last sign-in {fmtAgo(u.lastLoginAt)}
                    </span>
                  </span>
                  <span className="flex gap-2">
                    <button onClick={() => resetPassword(u)} className={secondaryBtn + ' !px-3 !py-1.5 text-xs'}>Reset password</button>
                    {u.id !== me?.id && (
                      <button onClick={() => toggleActive(u)} className={secondaryBtn + ' !px-3 !py-1.5 text-xs'}>{u.active ? 'Disable' : 'Enable'}</button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          {facilities.data && (
            <Card title="Create a sign-in">
              <AddUserForm
                key={selected ?? 'all'}
                facilities={facilities.data}
                presetFacility={selected}
                onAdded={(u) => {
                  setMessage(`Account created: ${u.username} (${ROLE_LABEL[u.role]}${u.facilityName ? `, ${u.facilityName}` : ''}).`);
                  users.reload();
                  facilities.reload();
                }}
              />
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
