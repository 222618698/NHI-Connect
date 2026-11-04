export interface PatientSummary {
  patientId: string;
  nationalId: string;
  fullName: string;
  dateOfBirth: string;
  sex: string;
}

export type EntryType = 'ENCOUNTER' | 'LAB' | 'MEDICATION';

export interface TimelineEntry {
  id: string;
  type: EntryType;
  date: string;
  title: string;
  detail: string | null;
  facilityName: string;
  facilityShortName: string;
  province: string;
  facilityLastSyncedAt: string | null;
}

export interface UnifiedRecord {
  patient: PatientSummary;
  facilityCount: number;
  provinces: string[];
  timeline: TimelineEntry[];
  completenessNotice: string;
}
