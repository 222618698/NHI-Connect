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

// ---------------------------------------------------------------- accounts

export type Role = 'ADMIN' | 'CLINIC' | 'CLINICIAN';

export interface SessionUser {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  facilityId: string | null;
  facilityName: string | null;
}

export interface LoginResult {
  token: string;
  user: SessionUser;
}

// ---------------------------------------------------------------- admin

export interface AdminOverview {
  stats: { facilities: number; users: number; patients: number; signInsToday: number; failedSignInsToday: number; recordViewsToday: number };
  activeSessions: { username: string; fullName: string; role: Role; facilityName: string | null; signedInAt: string; lastSeenAt: string }[];
}

export interface Facility {
  id: string;
  name: string;
  shortName: string;
  province: string;
  connectionType: string;
  status: string;
  onboardedAt: string | null;
  lastSyncedAt: string | null;
  userCount: number;
  patientCount: number;
}

export interface UserAccount {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  facilityId: string | null;
  facilityName: string | null;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface NewUserAccount {
  username: string;
  fullName: string;
  password: string;
  role: Role;
  facilityId: string | null;
}

export type Outcome = 'SUCCESS' | 'FAILED' | 'FLAGGED';

export interface AuditRow {
  id: string;
  occurredAt: string;
  username: string | null;
  fullName: string | null;
  role: Role | null;
  facilityName: string | null;
  eventType: string;
  patientName: string | null;
  target: string | null;
  outcome: Outcome;
}

// ---------------------------------------------------------------- clinic

export interface ClinicStaff {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
  signedInNow: boolean;
}

export interface ClinicOverview {
  facility: { id: string; name: string; province: string };
  stats: { patients: number; entriesAddedThisMonth: number; documents: number; pendingUpdates: number };
  staff: ClinicStaff[];
  recentActivity: AuditRow[];
}

export interface ClinicPatient {
  patientId: string;
  nationalId: string;
  fullName: string;
  dateOfBirth: string;
  sex: string;
  localPatientId: string;
  linkedAt: string;
  documentCount: number;
}

export interface NewPatient {
  nationalId: string;
  firstName: string;
  surname: string;
  dateOfBirth: string;
  sex: 'Male' | 'Female' | '';
  localPatientId: string;
}

export type EncounterType = 'OUTPATIENT' | 'EMERGENCY' | 'ADMISSION' | 'ANTENATAL' | 'FOLLOW_UP';

export interface NewEntry {
  type: EntryType;
  date: string;
  encounterType: EncounterType | null;
  title: string;
  detail: string;
}

/** REQ-004: result of the duplicate-test check. */
export interface DuplicateCheck {
  warning: boolean;
  windowDays: number;
  priorResult: { testName: string; date: string; facilityName: string; value: string | null; daysAgo: number } | null;
}

/** REQ-006: an active consent restriction recorded at a clinic. */
export interface ConsentRestriction {
  id: string;
  patientId: string;
  ownerFacilityId: string;
  ownerFacilityName: string;
  excludedFacilityId: string | null;
  excludedFacilityName: string | null;
  reason: string;
  createdBy: string;
  createdAt: string;
}

export interface BreakGlassEvent {
  id: string;
  patientId: string;
  patientName: string;
  userName: string;
  facilityName: string;
  reasonCode: string;
  freeText: string;
  createdAt: string;
  reviewStatus: 'PENDING_REVIEW' | 'JUSTIFIED' | 'NOT_JUSTIFIED';
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
}

/** Something a clinician/nurse added to a record, sent to their clinic for review. */
export interface RecordUpdate {
  id: string;
  patientId: string;
  patientName: string;
  nationalId: string;
  facilityName: string;
  submittedBy: string;
  entryType: 'ENCOUNTER' | 'LAB' | 'MEDICATION' | 'DOCUMENT';
  summary: string;
  submittedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export interface PatientDocument {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  description: string | null;
  facilityName: string;
  uploadedBy: string;
  uploadedAt: string;
}
