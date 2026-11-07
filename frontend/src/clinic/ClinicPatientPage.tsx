import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import DocumentList from '../components/DocumentList';
import { AddEntryForm, UploadForm } from '../components/RecordForms';
import TimelineItem from '../components/TimelineItem';
import { Card, ErrorBox } from '../components/ui';
import { useLoad } from '../useLoad';

export default function ClinicPatientPage() {
  const { patientId = '' } = useParams();
  const record = useLoad(() => api.getRecord(patientId), [patientId]);
  const docs = useLoad(() => api.listDocuments(patientId), [patientId]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const r = record.data;
  // Newest first here: clinic staff mostly care about what was just added.
  const timeline = r ? [...r.timeline].reverse() : [];

  return (
    <div className="mx-auto max-w-[1180px]">
      <Link to="/clinic/patients" className="mb-5 inline-block text-[13px] font-semibold text-teal hover:underline">&larr; All patients</Link>

      {record.error && <ErrorBox>{record.error}</ErrorBox>}
      {!r && !record.error && <p className="text-sm text-ink-faint">Loading&hellip;</p>}

      {r && (
        <>
          <section className="mb-7 rounded-2xl border border-line bg-white px-7 py-6">
            <h2 className="mb-2 text-[23px] font-bold">{r.patient.fullName}</h2>
            <div className="flex flex-wrap gap-x-7 gap-y-1 text-sm text-ink-muted">
              <span>DOB: {r.patient.dateOfBirth}</span>
              <span>Sex: {r.patient.sex}</span>
              <span className="font-mono">National ID: {r.patient.nationalId}</span>
              <span>{r.facilityCount} facilit{r.facilityCount === 1 ? 'y' : 'ies'} &middot; {r.timeline.length} {r.timeline.length === 1 ? 'entry' : 'entries'}</span>
            </div>
          </section>

          <div className="mb-8 grid gap-6 lg:grid-cols-2">
            <Card title="Add to this patient's record">
              <AddEntryForm patientId={patientId} onSaved={record.reload} />
            </Card>
            <div className="flex flex-col gap-6">
              <Card title="Upload a document">
                <UploadForm patientId={patientId} onSaved={docs.reload} />
              </Card>
              <Card title={`Documents (${docs.data?.length ?? 0})`}>
                {docs.error && <ErrorBox>{docs.error}</ErrorBox>}
                {docs.data && <DocumentList docs={docs.data} />}
              </Card>
            </div>
          </div>

          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="text-[19px] font-bold">National record timeline</h3>
            <span className="text-[13px] text-ink-faint">Most recent first &darr;</span>
          </div>
          {timeline.length === 0 && <p className="text-sm text-ink-muted">No entries yet. Add the first visit above.</p>}
          <div className="flex flex-col gap-3">
            {timeline.map((entry) => (
              <TimelineItem
                key={entry.id}
                entry={entry}
                expanded={expandedId === entry.id}
                onToggle={() => setExpandedId((cur) => (cur === entry.id ? null : entry.id))}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
