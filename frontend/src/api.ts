import type {
  AdminOverview, AuditRow, BreakGlassEvent, ClinicOverview, ClinicPatient, ConsentRestriction, DuplicateCheck, Facility,
  LoginResult, NewEntry, NewPatient, NewUserAccount, PatientDocument, PatientSummary, RecordUpdate, Role, SessionUser,
  UnifiedRecord, UserAccount,
} from './types';

/** Any failed API call. `code` is set for special cases, e.g. CONSENT_RESTRICTED (REQ-006). */
export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public breakGlassAvailable = false) {
    super(message);
  }
}
export class NotFoundError extends ApiError {}

export const isConsentRestricted = (e: unknown): e is ApiError => e instanceof ApiError && e.code === 'CONSENT_RESTRICTED';

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
    throw res.status === 404
      ? new NotFoundError(message, 404)
      : new ApiError(message, res.status, body.code, Boolean(body.breakGlassAvailable));
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

  // REQ-004 duplicate-test check, REQ-009 referral summary, REQ-005 FHIR export
  checkDuplicate: (patientId: string, testName: string, orderDate?: string) =>
    sendJson<DuplicateCheck>('POST', '/engine/api/v1/decision-support/check-duplicate', { patientId, testName, orderDate }),
  referralSummary: async (patientId: string) =>
    (await request(`/engine/api/v1/patients/${patientId}/referral-summary`)).blob(),
  fhirExport: async (patientId: string, profile: 'full' | 'lite') =>
    (await request(`/engine/api/v1/fhir/Patient/${patientId}/$everything?profile=${profile}`)).blob(),

  // REQ-006 consent and break-glass
  breakGlass: (patientId: string, reasonCode: string, freeText: string) =>
    sendJson<UnifiedRecord>('POST', `/engine/api/v1/patients/${patientId}/break-glass`, { reasonCode, freeText }),
  clinicFacilities: () => getJson<{ id: string; name: string }[]>('/engine/api/v1/clinic/facilities'),
  consentList: (patientId: string) => getJson<ConsentRestriction[]>(`/engine/api/v1/clinic/patients/${patientId}/consent`),
  consentAdd: (patientId: string, excludedFacilityId: string | null, reason: string) =>
    sendJson<ConsentRestriction>('POST', `/engine/api/v1/clinic/patients/${patientId}/consent`, { excludedFacilityId, reason }),
  consentLift: (patientId: string, restrictionId: string) =>
    request(`/engine/api/v1/clinic/patients/${patientId}/consent/${restrictionId}`, { method: 'DELETE' }).then(() => undefined),
  breakGlassEvents: () => getJson<BreakGlassEvent[]>('/engine/api/v1/admin/break-glass'),
  reviewBreakGlass: (id: string, decision: 'JUSTIFIED' | 'NOT_JUSTIFIED', note: string) =>
    sendJson<void>('POST', `/engine/api/v1/admin/break-glass/${id}/review`, { decision, note }),
};

/** Saves a downloaded blob as a file in the browser. */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
