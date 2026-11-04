import type { PatientSummary, UnifiedRecord } from './types';

export class NotFoundError extends Error {}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (res.status === 404) {
    const body = await res.json().catch(() => ({}));
    throw new NotFoundError(body.message ?? 'Not found');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  searchById: (idNumber: string) =>
    getJson<PatientSummary>(`/engine/api/v1/patients/search?idNumber=${encodeURIComponent(idNumber)}`),
  getRecord: (patientId: string) =>
    getJson<UnifiedRecord>(`/engine/api/v1/patients/${patientId}/record`),
};
