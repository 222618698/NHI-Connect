import { useState } from 'react';
import type { DuplicateCheck, TimelineEntry } from '../types';
import { TYPE_LABEL, fmtFull, fmtShort, fmtSynced, provinceColour } from '../format';
import { api } from '../api';
import { DuplicateWarning } from './RecordForms';

interface Props {
  entry: TimelineEntry;
  expanded: boolean;
  onToggle: () => void;
  /** When set, lab results offer a duplicate-test check before re-ordering (REQ-004). */
  patientId?: string;
}

export default function TimelineItem({ entry, expanded, onToggle, patientId }: Props) {
  const c = provinceColour(entry.province);
  const [check, setCheck] = useState<DuplicateCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkReorder = async () => {
    if (!patientId) return;
    setChecking(true);
    setError(null);
    try {
      setCheck(await api.checkDuplicate(patientId, entry.title));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <button onClick={onToggle} aria-expanded={expanded} className="flex w-full items-center gap-4 px-5 py-4 text-left">
        <span className="w-[92px] shrink-0 whitespace-nowrap text-xs font-semibold text-ink-faint">{fmtShort(entry.date)}</span>
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.text }} />
        <span className="min-w-0 flex-1">
          <span className="mb-0.5 block text-[15px] font-semibold">{entry.title}</span>
          <span className="block text-xs text-ink-faint">{TYPE_LABEL[entry.type]}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block whitespace-nowrap rounded-full px-3 py-1 font-mono text-xs font-semibold" style={{ background: c.bg, color: c.text }}>
            {entry.facilityShortName} &middot; {entry.province}
          </span>
          <span className="mt-1 block whitespace-nowrap text-[10px] text-[#B0B9C2]">Synced {fmtSynced(entry.facilityLastSyncedAt)}</span>
        </span>
        <span className="shrink-0 text-sm text-[#B8C1C9]">{expanded ? '▴' : '▾'}</span>
      </button>
      {expanded && (
        <div className="border-t border-[#F0F3F5] px-5 pb-5 text-sm leading-relaxed text-ink-soft sm:pl-[118px]">
          <p className="pt-4">{entry.detail}</p>
          <p className="mt-2.5 text-xs text-ink-faint">
            Source: {entry.facilityName}, {entry.province} &middot; {fmtFull(entry.date)}
          </p>
          {entry.type === 'LAB' && patientId && (
            <div className="mt-3">
              {!check && (
                <button onClick={checkReorder} disabled={checking} className="rounded-lg border border-teal px-3 py-1.5 text-xs font-semibold text-teal hover:bg-teal-tint">
                  {checking ? 'Checking…' : 'Order this test again'}
                </button>
              )}
              {error && <p className="mt-2 text-xs text-[#9C3B3B]">{error}</p>}
              {check?.warning && (
                <DuplicateWarning check={check}>
                  <span className="text-[12px]">Consider using this result instead of repeating the test.</span>
                </DuplicateWarning>
              )}
              {check && !check.warning && (
                <p role="status" className="rounded-lg bg-teal-tint px-3 py-2 text-xs font-semibold text-teal">
                  No equivalent result in the last {check.windowDays} days &mdash; no duplicate-test concern.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
