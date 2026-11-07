import type {
  AdminOverview, AuditRow, ClinicOverview, ClinicPatient, Facility, LoginResult, NewEntry, NewPatient,
  NewUserAccount, PatientDocument, PatientSummary, RecordUpdate, Role, SessionUser, UnifiedRecord, UserAccount,
} from './types';

export class NotFoundError extends Error {}

const TOKEN_KEY = 'nhi.token';

export const tokenStore = {
  get: () => { try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t: string) => { try { sessionStorage.setItem(TOKEN_KEY, t); } catch { /* private mode */ } },
  clear: () => { try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ } },
};

/** Called when the server says the session is no longer valid (expired, signed out, account disabled). */
let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

async function request(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  const token = tokenStore.get();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch {
    throw new Error('Could not reach NHI-Connect. Check that the backend is running and try again.');
  }
  if (res.status === 401 && token) {
    tokenStore.clear();
    onUnauthorized();
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body.message ?? `Request failed (${res.status})`;
    throw res.status === 404 ? new NotFoundError(message) : new Error(message);
  }
  return res;
}

const getJson = async <T>(url: string) => (await request(url)).json() as Promise<T>;

const sendJson = async <T>(method: string, url: string, body: unknown) => {
  const res = await request(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return (res.status === 204 ? undefined : res.json()) as Promise<T>;
};

export const api = {
  // auth
  login: (username: string, password: string, role: Role) =>
    sendJson<LoginResult>('POST', '/security/api/v1/auth/login', { username, password, role }),
  me: () => getJson<SessionUser>('/security/api/v1/auth/me'),
  logout: () => request('/security/api/v1/auth/logout', { method: 'POST' }).then(() => undefined),

  // national record (clinician + clinic)
  searchById: (idNumber: string) =>
    getJson<PatientSummary>(`/engine/api/v1/patients/search?idNumber=${encodeURIComponent(idNumber)}`),
  getRecord: (patientId: string) => getJson<UnifiedRecord>(`/engine/api/v1/patients/${patientId}/record`),
  listDocuments: (patientId: string) => getJson<PatientDocument[]>(`/engine/api/v1/patients/${patientId}/documents`),
  downloadDocument: async (documentId: string) => (await request(`/engine/api/v1/documents/${documentId}`)).blob(),

  // admin
  adminOverview: () => getJson<AdminOverview>('/engine/api/v1/admin/overview'),
  listFacilities: () => getJson<Facility[]>('/engine/api/v1/admin/facilities'),
  createFacility: (name: string, province: string) => sendJson<Facility>('POST', '/engine/api/v1/admin/facilities', { name, province }),
  listUsers: () => getJson<UserAccount[]>('/engine/api/v1/admin/users'),
  createUser: (u: NewUserAccount) => sendJson<UserAccount>('POST', '/engine/api/v1/admin/users', u),
  setUserActive: (id: string, active: boolean) => sendJson<UserAccount>('PATCH', `/engine/api/v1/admin/users/${id}`, { active }),
  resetPassword: (id: string, password: string) => sendJson<void>('POST', `/engine/api/v1/admin/users/${id}/password`, { password }),
  audit: (f: { facilityId?: string; eventType?: string; outcome?: string }) => {
    const q = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]);
    return getJson<AuditRow[]>(`/engine/api/v1/admin/audit?${q}`);
  },

  // clinic
  clinicOverview: () => getJson<ClinicOverview>('/engine/api/v1/clinic/overview'),
  clinicPatients: () => getJson<ClinicPatient[]>('/engine/api/v1/clinic/patients'),
  addPatient: (p: NewPatient) =>
    sendJson<{ patient: ClinicPatient; alreadyOnNationalRecord: boolean }>('POST', '/engine/api/v1/clinic/patients', {
      ...p, localPatientId: p.localPatientId || null,
    }),
  clinicUpdates: () => getJson<RecordUpdate[]>('/engine/api/v1/clinic/updates'),
  reviewUpdate: (id: string) => request(`/engine/api/v1/clinic/updates/${id}/review`, { method: 'POST' }).then(() => undefined),

  // adding to a record (clinic staff + clinicians/nurses)
  addEntry: (patientId: string, e: NewEntry) =>
    sendJson<{ id: string; sentForReview: boolean }>('POST', `/engine/api/v1/patients/${patientId}/entries`, e),
  uploadDocument: async (patientId: string, file: File, description: string) => {
    const form = new FormData();
    form.append('file', file);
    if (description) form.append('description', description);
    const res = await request(`/engine/api/v1/patients/${patientId}/documents`, { method: 'POST', body: form });
    return res.json() as Promise<PatientDocument>;
  },

  adminUpdates: () => getJson<RecordUpdate[]>('/engine/api/v1/admin/updates'),
};
