import { useState } from 'react';
import { api } from '../api';
import Badge from '../components/Badge';
import { Card, ErrorBox, PageHeading, inputCls, secondaryBtn } from '../components/ui';
import { BREAK_GLASS_REASONS, fmtStamp } from '../format';
import type { BreakGlassEvent } from '../types';
import { useLoad } from '../useLoad';

const REASON = Object.fromEntries(BREAK_GLASS_REASONS.map((r) => [r.code, r.label]));
const STATUS: Record<BreakGlassEvent['reviewStatus'], { label: string; tone: 'good' | 'warn' | 'bad' }> = {
  PENDING_REVIEW: { label: 'Pending review', tone: 'warn' },
  JUSTIFIED: { label: 'Justified', tone: 'good' },
  NOT_JUSTIFIED: { label: 'Not justified', tone: 'bad' },
};

/** REQ-006: administrators review every emergency (break-glass) access to a restricted record. */
export default function BreakGlassPage() {
  const events = useLoad(api.breakGlassEvents);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const review = async (id: string, decision: 'JUSTIFIED' | 'NOT_JUSTIFIED') => {
    setError(null);
    try {
      await api.reviewBreakGlass(id, decision, notes[id] ?? '');
      events.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const pending = events.data?.filter((e) => e.reviewStatus === 'PENDING_REVIEW').length ?? 0;
  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeading title="Break-Glass Reviews" sub="Every emergency access to a consent-restricted record, for review. Decisions are written to the audit log.">
        <button onClick={events.reload} className={secondaryBtn}>Refresh</button>
      </PageHeading>
      {error && <div className="mb-4"><ErrorBox>{error}</ErrorBox></div>}
      {events.error && <ErrorBox>{events.error}</ErrorBox>}
      <Card title={`Events${pending ? ` (${pending} pending)` : ''}`}>
        {events.data && events.data.length === 0 && <p className="text-sm text-ink-muted">No break-glass access has been used.</p>}
        <ul className="divide-y divide-line">
          {events.data?.map((e) => (
            <li key={e.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold">{e.userName} <span className="font-normal text-ink-muted">({e.facilityName})</span> opened <b>{e.patientName}</b></p>
                  <p className="text-[13px] text-ink-soft"><b>{REASON[e.reasonCode] ?? e.reasonCode}:</b> {e.freeText}</p>
                  <p className="text-xs text-ink-faint">{fmtStamp(e.createdAt)}{e.reviewedBy ? ` · reviewed by ${e.reviewedBy} ${fmtStamp(e.reviewedAt)}${e.reviewNote ? ` — “${e.reviewNote}”` : ''}` : ''}</p>
                </div>
                <Badge tone={STATUS[e.reviewStatus].tone}>{STATUS[e.reviewStatus].label}</Badge>
              </div>
              {e.reviewStatus === 'PENDING_REVIEW' && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    aria-label="Review note"
                    placeholder="Review note (optional)"
                    value={notes[e.id] ?? ''}
                    onChange={(x) => setNotes((n) => ({ ...n, [e.id]: x.target.value }))}
                    className={inputCls + ' max-w-[360px] !py-1.5'}
                  />
                  <button onClick={() => review(e.id, 'JUSTIFIED')} className="rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-dark">Justified</button>
                  <button onClick={() => review(e.id, 'NOT_JUSTIFIED')} className="rounded-lg bg-[#B23B3B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#962f2f]">Not justified</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
