import { createContext, useContext, useState, type ReactNode } from 'react';

// Step 1: in-memory demo data for the Administrator area. Replace with API calls once
// the backend exposes facility, mapping and audit endpoints.

export type ConnectionType = 'Database Connection' | 'File Extract' | 'Message Endpoint';
export type FacilityStatus = 'Active' | 'Testing' | 'Draft';

export interface Facility {
  id: string;
  name: string;
  shortName: string;
  province: string;
  connectionType: ConnectionType;
  status: FacilityStatus;
}

export type CodeType = 'Diagnosis' | 'Medication' | 'Observation';

export interface CodeMapping {
  localCode: string;
  localDescription: string;
  type: CodeType;
  standardCode: string | null;
}

export type Outcome = 'Success' | 'Flagged' | 'Failed';

export interface AuditEvent {
  id: string;
  timestamp: string; // "YYYY-MM-DD HH:mm"
  user: string;
  role: string | null;
  hospital: string | null;
  eventType: string;
  target: string;
  outcome: Outcome;
}

export const PROVINCES = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo',
  'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape',
];

export const CONNECTION_TYPES: { value: ConnectionType; label: string }[] = [
  { value: 'Database Connection', label: 'Database Connection (nightly extract)' },
  { value: 'File Extract', label: 'File Extract (scheduled upload)' },
  { value: 'Message Endpoint', label: 'Message Endpoint (real-time HL7 / FHIR)' },
];

const INITIAL_FACILITIES: Facility[] = [
  { id: 'braamfontein', name: 'Braamfontein General Hospital', shortName: 'Braamfontein', province: 'Gauteng', connectionType: 'File Extract', status: 'Active' },
  { id: 'umhlanga', name: 'Umhlanga District Hospital', shortName: 'Umhlanga', province: 'KwaZulu-Natal', connectionType: 'Message Endpoint', status: 'Active' },
  { id: 'riverbend', name: 'Riverbend Provincial Hospital', shortName: 'Riverbend', province: 'Gauteng', connectionType: 'Database Connection', status: 'Testing' },
];

const RIVERBEND_CODES: CodeMapping[] = [
  { localCode: 'DX-014', localDescription: 'Pulmonary TB (local diagnosis code)', type: 'Diagnosis', standardCode: 'ICD-10 A15.0' },
  { localCode: 'MED-0231', localDescription: 'Amlodipine 5mg tablet', type: 'Medication', standardCode: 'Amlodipine 5mg (std.)' },
  { localCode: 'LAB-88', localDescription: 'Full Blood Count panel', type: 'Observation', standardCode: 'FBC (std. panel code)' },
  { localCode: 'DX-072', localDescription: 'Local code, description unclear', type: 'Diagnosis', standardCode: null },
  { localCode: 'MED-0587', localDescription: 'Local formulary item, new code', type: 'Medication', standardCode: null },
  { localCode: 'LAB-14', localDescription: 'Troponin I quantitative', type: 'Observation', standardCode: 'Troponin I (std.)' },
];

const INITIAL_MAPPINGS: Record<string, CodeMapping[]> = {
  braamfontein: [
    { localCode: 'BG-DX-101', localDescription: 'Type 2 diabetes mellitus', type: 'Diagnosis', standardCode: 'ICD-10 E11.9' },
    { localCode: 'BG-MED-12', localDescription: 'Metformin 500mg tablet', type: 'Medication', standardCode: 'Metformin 500mg (std.)' },
    { localCode: 'BG-LAB-7', localDescription: 'HbA1c', type: 'Observation', standardCode: 'HbA1c (std.)' },
  ],
  umhlanga: [
    { localCode: 'UM-DX-3', localDescription: 'Essential hypertension', type: 'Diagnosis', standardCode: 'ICD-10 I10' },
    { localCode: 'UM-LAB-22', localDescription: 'Serum creatinine', type: 'Observation', standardCode: 'Creatinine (std.)' },
  ],
  riverbend: RIVERBEND_CODES,
};

const INITIAL_AUDIT: AuditEvent[] = [
  { id: 'a7', timestamp: '2026-07-26 09:14', user: 'Dr T. Moloi', role: 'Clinician', hospital: 'Riverbend', eventType: 'Patient Record View', target: 'Patient: B. Mahlangu', outcome: 'Success' },
  { id: 'a6', timestamp: '2026-07-26 08:52', user: 'N. Sithole', role: 'Nurse', hospital: 'Braamfontein', eventType: 'Patient Search', target: 'ID: 8801015800083', outcome: 'Success' },
  { id: 'a5', timestamp: '2026-07-25 17:03', user: 'S. Mahlangu', role: 'System Admin', hospital: null, eventType: 'Mapping Change', target: 'DX-014 → ICD-10 A15.0', outcome: 'Success' },
  { id: 'a4', timestamp: '2026-07-25 14:41', user: 'System', role: null, hospital: 'Riverbend', eventType: 'MPI Review Decision', target: 'Candidate match rejected', outcome: 'Flagged' },
  { id: 'a3', timestamp: '2026-07-25 11:20', user: 'Unknown', role: null, hospital: null, eventType: 'Login Attempt', target: 'Username: r.vandermerwe', outcome: 'Failed' },
  { id: 'a2', timestamp: '2026-07-24 16:08', user: 'Dr A. Khumalo', role: 'Clinician', hospital: 'Umhlanga', eventType: 'Patient Record View', target: 'Patient: B. Mahlangu', outcome: 'Success' },
  { id: 'a1', timestamp: '2026-07-24 10:55', user: 'P. Govender', role: 'Hospital Admin', hospital: 'Braamfontein', eventType: 'User Account Created', target: 'New nurse account', outcome: 'Success' },
];

const pad = (n: number) => String(n).padStart(2, '0');
const nowStamp = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'facility';

interface AdminData {
  facilities: Facility[];
  mappings: Record<string, CodeMapping[]>;
  audit: AuditEvent[];
  addFacility: (f: Omit<Facility, 'id' | 'shortName' | 'status'>) => Facility;
  setFacilityStatus: (id: string, status: FacilityStatus) => void;
  setMapping: (facilityId: string, localCode: string, standardCode: string) => void;
  seedCodes: (facilityId: string, codes: CodeMapping[]) => void;
  log: (e: Omit<AuditEvent, 'id' | 'timestamp'>) => void;
}

const AdminDataContext = createContext<AdminData | null>(null);

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const [facilities, setFacilities] = useState(INITIAL_FACILITIES);
  const [mappings, setMappings] = useState(INITIAL_MAPPINGS);
  const [audit, setAudit] = useState(INITIAL_AUDIT);

  const log: AdminData['log'] = (e) =>
    setAudit((a) => [{ ...e, id: `a${Date.now()}${Math.random()}`, timestamp: nowStamp() }, ...a]);

  const addFacility: AdminData['addFacility'] = (f) => {
    let id = slug(f.name);
    while (facilities.some((x) => x.id === id)) id += '-2';
    const facility: Facility = { ...f, id, shortName: f.name.split(' ')[0], status: 'Draft' };
    setFacilities((fs) => [...fs, facility]);
    setMappings((m) => ({ ...m, [id]: [] }));
    return facility;
  };

  const setFacilityStatus: AdminData['setFacilityStatus'] = (id, status) =>
    setFacilities((fs) => fs.map((f) => (f.id === id ? { ...f, status } : f)));

  const setMapping: AdminData['setMapping'] = (facilityId, localCode, standardCode) =>
    setMappings((m) => ({
      ...m,
      [facilityId]: (m[facilityId] ?? []).map((c) => (c.localCode === localCode ? { ...c, standardCode } : c)),
    }));

  const seedCodes: AdminData['seedCodes'] = (facilityId, codes) =>
    setMappings((m) => ((m[facilityId] ?? []).length ? m : { ...m, [facilityId]: codes }));

  return (
    <AdminDataContext.Provider value={{ facilities, mappings, audit, addFacility, setFacilityStatus, setMapping, seedCodes, log }}>
      {children}
    </AdminDataContext.Provider>
  );
}

export function useAdminData() {
  const ctx = useContext(AdminDataContext);
  if (!ctx) throw new Error('useAdminData must be used inside AdminDataProvider');
  return ctx;
}

/** Sample local codes a new facility "sends" during its test extract. */
export const sampleCodesFor = (prefix: string): CodeMapping[] => [
  { localCode: `${prefix}-DX-01`, localDescription: 'Hypertension (local code)', type: 'Diagnosis', standardCode: null },
  { localCode: `${prefix}-MED-01`, localDescription: 'Enalapril 10mg tablet', type: 'Medication', standardCode: null },
  { localCode: `${prefix}-LAB-01`, localDescription: 'Urea & electrolytes panel', type: 'Observation', standardCode: null },
];
