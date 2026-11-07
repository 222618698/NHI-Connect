import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header';
import TimelineItem from '../components/TimelineItem';
import DocumentList from '../components/DocumentList';
import BreakGlassPanel from '../components/BreakGlassPanel';
import { AddEntryForm, UploadForm } from '../components/RecordForms';
import { api, isConsentRestricted, saveBlob, type ApiError } from '../api';
import { useAuth } from '../auth';
import type { PatientDocument, UnifiedRecord } from '../types';

type UpdateTab = 'entry' | 'document';

export default function RecordPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [record, setRecord] = useState<UnifiedRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restricted, setRestricted] = useState<ApiError | null>(null);
  const [emergency, setEmergency] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [docs, setDocs] = useState<PatientDocument[] | null>(null);
  const [updating, setUpdating] = useState<UpdateTab | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const loadRecord = useCallback(() => {
    if (!patientId) return;
    api.getRecord(patientId)
      .then((r) => { setRecord(r); setRestricted(null); })
      .catch((e: Error) => (isConsentRestricted(e) ? setRestricted(e) : setError(e.message)));
  }, [patientId]);
  const loadDocs = useCallback(() => {
    if (!patientId) return;
    api.listDocuments(patientId).then(setDocs).catch(() => setDocs([]));
  }, [patientId]);

  useEffect(() => { loadRecord(); loadDocs(); }, [loadRecord, loadDocs]);

  const sentNote = `Sent to ${user?.facilityName ?? 'your clinic'} and the administrator for review.`;

  const download = async (kind: 'referral' | 'fhir-full' | 'fhir-lite') => {
    if (!patientId || !record) return;
    setDownloading(kind);
    setDownloadError(null);
    const surname = record.patient.fullName.split(' ').slice(-1)[0].toLowerCase();
    try {
      if (kind === 'referral') saveBlob(await api.referralSummary(patientId), `referral-summary-${surname}.pdf`);
      else {
        const profile = kind === 'fhir-full' ? 'full' : 'lite';
        saveBlob(await api.fhirExport(patientId, profile), `fhir-${profile}-${surname}.json`);
      }
    } catch (e) {
      setDownloadError((e as Error).message);
    } finally {
      setDownloading(null);
    }
  };

  const back = (
    <button onClick={() => navigate('/')} className="whitespace-nowrap rounded-lg border border-[#D6DFE6] bg-white px-3.5 py-2 text-[13px] font-semibold text-ink-soft hover:bg-canvas">
      &larr; Back to Search
    </button>
  );

  const tabBtn = (tab: UpdateTab, label: string) => (
    <button
      type="button"
      onClick={() => setUpdating(tab)}
      aria-pressed={updating === tab}
      className={'rounded-lg px-4 py-2 text-[13px] font-semibold ' + (updating === tab ? 'bg-teal text-white' : 'text-ink-muted hover:bg-canvas')}
    >
      {label}
    </button>
  );

  const smallBtn = 'whitespace-nowrap rounded-lg border border-[#D6DFE6] bg-white px-3 py-2 text-[12.5px] font-semibold text-ink-soft hover:border-teal hover:text-teal disabled:opacity-60';

  return (
    <div className="min-h-screen">
      <Header left={back} />
      <main className="mx-auto max-w-[820px] px-6 pb-20 pt-12">
        {error && <p className="text-sm text-[#9C3B3B]">{error}</p>}
        {!record && !error && !restricted && <p className="text-sm text-ink-faint">Loading unified record&hellip;</p>}

        {restricted && !record && patientId && (
          <BreakGlassPanel
            patientId={patientId}
            message={restricted.message}
            allowed={restricted.breakGlassAvailable}
            onGranted={(r) => { setRecord(r); setEmergency(true); }}
          />
        )}

        {record && patientId && (
          <>
            {emergency && (
              <div role="alert" className="mb-5 rounded-xl border-2 border-[#E3B3B3] bg-[#FBE7E7] px-5 py-3.5 text-[13px] text-[#9C3B3B]">
                <b>Emergency (break-glass) access.</b> The patient restricted this record; your access has been logged and flagged for
                administrator review. It applies to this view only &mdash; leaving the page restores the restriction.
              </div>
            )}

            <section className="mb-5 rounded-2xl border border-line bg-white px-8 py-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="mb-2 text-[23px] font-bold">{record.patient.fullName}</h1>
                  <div className="flex flex-wrap gap-x-7 gap-y-1 text-sm text-ink-muted">
                    <span>DOB: {record.patient.dateOfBirth}</span>
                    <span>Sex: {record.patient.sex}</span>
                    <span className="font-mono">National ID: {record.patient.nationalId}</span>
                  </div>
                </div>
                {updating === null && !emergency && (
                  <button onClick={() => setUpdating('entry')} className="whitespace-nowrap rounded-lg bg-teal px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-teal-dark">
                    + Update Record
                  </button>
                )}
              </div>
              {!emergency && (
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                  <button onClick={() => download('referral')} disabled={downloading !== null} className={smallBtn}>
                    {downloading === 'referral' ? 'Preparing…' : '⤓ Referral Summary (PDF)'}
                  </button>
                  <button onClick={() => download('fhir-full')} disabled={downloading !== null} className={smallBtn}>
                    {downloading === 'fhir-full' ? 'Preparing…' : '⤓ FHIR R4 (full)'}
                  </button>
                  <button onClick={() => download('fhir-lite')} disabled={downloading !== null} className={smallBtn}>
                    {downloading === 'fhir-lite' ? 'Preparing…' : '⤓ FHIR R4 (lite, low bandwidth)'}
                  </button>
                  {downloadError && <span className="text-xs text-[#9C3B3B]">{downloadError}</span>}
                </div>
              )}
            </section>

            {updating !== null && (
              <section className="mb-6 rounded-2xl border border-teal bg-white px-7 py-6">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-base font-bold">Update this patient&apos;s record</h2>
                  <button onClick={() => setUpdating(null)} className="text-[13px] font-semibold text-ink-muted hover:text-ink">Close &times;</button>
                </div>
                <p className="mb-4 text-[13px] text-ink-muted">
                  E.g. a blood test result you received. It is added at {user?.facilityName ?? 'your clinic'} and sent to the clinic and the administrator for review.
                </p>
                <div className="mb-5 flex gap-1.5 rounded-xl bg-canvas p-1">
                  {tabBtn('entry', 'Lab result, visit or medication')}
                  {tabBtn('document', 'Upload document')}
                </div>
                {updating === 'entry'
                  ? <AddEntryForm patientId={patientId} onSaved={loadRecord} savedNote={sentNote} />
                  : <UploadForm patientId={patientId} onSaved={loadDocs} savedNote={sentNote} />}
              </section>
            )}

            <div className="mb-5 flex items-center gap-3.5 rounded-xl border border-[#BFE6E2] bg-teal-tint px-5 py-4">
              <span className="h-9 w-9 shrink-0 rounded-full bg-teal" />
              <div>
                <p className="text-sm font-bold text-[#0B5A62]">Nationwide record retrieved from a single ID lookup</p>
                <p className="mt-0.5 text-[13px] text-[#227079]">
                  This history spans {record.facilityCount} {record.facilityCount === 1 ? 'hospital' : 'hospitals'} across{' '}
                  {record.provinces.length} {record.provinces.length === 1 ? 'province' : 'provinces'} &mdash; {record.provinces.join(', ')}.
                </p>
              </div>
            </div>

            <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-line bg-amber-tint px-5 py-3.5">
              <span className="shrink-0">&#9888;</span>
              <p className="text-[13px] leading-normal text-amber-ink">{record.completenessNotice}</p>
            </div>

            {!emergency && docs && docs.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-3 text-[19px] font-bold">Documents ({docs.length})</h2>
                <DocumentList docs={docs} />
              </section>
            )}

            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-[19px] font-bold">Unified Record Timeline</h2>
              <span className="text-[13px] text-ink-faint">Oldest to most recent &darr;</span>
            </div>

            <div className="flex flex-col gap-3">
              {record.timeline.map((entry) => (
                <TimelineItem
                  key={entry.id}
                  entry={entry}
                  patientId={emergency ? undefined : patientId}
                  expanded={expandedId === entry.id}
                  onToggle={() => setExpandedId((cur) => (cur === entry.id ? null : entry.id))}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
