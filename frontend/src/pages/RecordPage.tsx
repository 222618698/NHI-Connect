import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header';
import TimelineItem from '../components/TimelineItem';
import { api } from '../api';
import type { UnifiedRecord } from '../types';

export default function RecordPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState<UnifiedRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) return;
    api.getRecord(patientId).then(setRecord).catch((e: Error) => setError(e.message));
  }, [patientId]);

  const back = (
    <button onClick={() => navigate('/')} className="whitespace-nowrap rounded-lg border border-[#D6DFE6] bg-white px-3.5 py-2 text-[13px] font-semibold text-ink-soft hover:bg-canvas">
      &larr; Back to Search
    </button>
  );

  return (
    <div className="min-h-screen">
      <Header left={back} />
      <main className="mx-auto max-w-[820px] px-6 pb-20 pt-12">
        {error && <p className="text-sm text-[#9C3B3B]">{error}</p>}
        {!record && !error && <p className="text-sm text-ink-faint">Loading unified record&hellip;</p>}

        {record && (
          <>
            <section className="mb-5 rounded-2xl border border-line bg-white px-8 py-7">
              <h1 className="mb-2 text-[23px] font-bold">{record.patient.fullName}</h1>
              <div className="flex flex-wrap gap-x-7 gap-y-1 text-sm text-ink-muted">
                <span>DOB: {record.patient.dateOfBirth}</span>
                <span>Sex: {record.patient.sex}</span>
                <span className="font-mono">National ID: {record.patient.nationalId}</span>
              </div>
            </section>

            <div className="mb-5 flex items-center gap-3.5 rounded-xl border border-[#BFE6E2] bg-teal-tint px-5 py-4">
              <span className="h-9 w-9 shrink-0 rounded-full bg-teal" />
              <div>
                <p className="text-sm font-bold text-[#0B5A62]">Nationwide record retrieved from a single ID lookup</p>
                <p className="mt-0.5 text-[13px] text-[#227079]">
                  This history spans {record.facilityCount} hospitals across {record.provinces.length} provinces &mdash; {record.provinces.join(', ')}.
                </p>
              </div>
            </div>

            <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-line bg-amber-tint px-5 py-3.5">
              <span className="shrink-0">&#9888;</span>
              <p className="text-[13px] leading-normal text-amber-ink">{record.completenessNotice}</p>
            </div>

            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-[19px] font-bold">Unified Record Timeline</h2>
              <span className="text-[13px] text-ink-faint">Oldest to most recent &darr;</span>
            </div>

            <div className="flex flex-col gap-3">
              {record.timeline.map((entry) => (
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
      </main>
    </div>
  );
}
