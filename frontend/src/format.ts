const ZA = 'en-ZA';

export const fmtShort = (iso: string) =>
  new Date(iso).toLocaleDateString(ZA, { day: '2-digit', month: 'short', year: 'numeric' });

export const fmtFull = (iso: string) =>
  new Date(iso).toLocaleDateString(ZA, { day: '2-digit', month: 'long', year: 'numeric' });

export const fmtSynced = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(ZA, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'never';

export const TYPE_LABEL = { ENCOUNTER: 'Encounter', LAB: 'Lab Result', MEDICATION: 'Medication' } as const;

const PROVINCE_COLOURS: Record<string, { bg: string; text: string }> = {
  'Gauteng':       { bg: '#E3F5F3', text: '#0E7C86' },
  'Western Cape':  { bg: '#E8EEFB', text: '#2C5FB0' },
  'KwaZulu-Natal': { bg: '#F3EAFB', text: '#7A3FA0' },
  'Eastern Cape':  { bg: '#FDEDE3', text: '#B4561C' },
  'Free State':    { bg: '#E6F2E6', text: '#2F7A3A' },
  'Limpopo':       { bg: '#EEF0F3', text: '#3D4954' },
};

export const provinceColour = (province: string) => PROVINCE_COLOURS[province] ?? { bg: '#EEF0F3', text: '#3D4954' };
