import type { Role } from './types';

const ZA = 'en-ZA';

export const fmtShort = (iso: string) =>
  new Date(iso).toLocaleDateString(ZA, { day: '2-digit', month: 'short', year: 'numeric' });

export const fmtFull = (iso: string) =>
  new Date(iso).toLocaleDateString(ZA, { day: '2-digit', month: 'long', year: 'numeric' });

export const fmtSynced = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(ZA, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'never';

/** "2026-11-06 14:05" style, for audit tables. */
export const fmtStamp = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** "5 min ago", "2 h ago", or a date. */
export const fmtAgo = (iso: string | null) => {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} h ago`;
  return fmtShort(iso);
};

export const fmtBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

export const todayIso = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const TYPE_LABEL = { ENCOUNTER: 'Encounter', LAB: 'Lab Result', MEDICATION: 'Medication' } as const;

export const ROLE_LABEL: Record<Role, string> = { ADMIN: 'Administrator', CLINIC: 'Clinic Staff', CLINICIAN: 'Clinician' };

export const EVENT_LABEL: Record<string, string> = {
  LOGIN: 'Sign In',
  LOGOUT: 'Sign Out',
  PATIENT_SEARCH: 'Patient Search',
  RECORD_VIEW: 'Patient Record View',
  PATIENT_CREATED: 'Patient Added',
  PATIENT_LINKED: 'Patient Linked to Clinic',
  ENTRY_ADDED: 'Record Entry Added',
  DOCUMENT_UPLOADED: 'Document Uploaded',
  DOCUMENT_VIEW: 'Document Opened',
  CLINIC_CREATED: 'Clinic Added',
  USER_CREATED: 'Account Created',
  USER_DISABLED: 'Account Disabled',
  USER_ENABLED: 'Account Enabled',
  PASSWORD_RESET: 'Password Reset',
  UPDATE_REVIEWED: 'Clinician Update Reviewed',
};

export const PROVINCES = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo',
  'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape',
];

const PROVINCE_COLOURS: Record<string, { bg: string; text: string }> = {
  'Gauteng':       { bg: '#E3F5F3', text: '#0E7C86' },
  'Western Cape':  { bg: '#E8EEFB', text: '#2C5FB0' },
  'KwaZulu-Natal': { bg: '#F3EAFB', text: '#7A3FA0' },
  'Eastern Cape':  { bg: '#FDEDE3', text: '#B4561C' },
  'Free State':    { bg: '#E6F2E6', text: '#2F7A3A' },
  'Limpopo':       { bg: '#EEF0F3', text: '#3D4954' },
};

export const provinceColour = (province: string) => PROVINCE_COLOURS[province] ?? { bg: '#EEF0F3', text: '#3D4954' };
