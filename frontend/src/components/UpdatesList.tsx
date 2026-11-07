import { Link } from 'react-router-dom';
import Badge from './Badge';
import { fmtAgo, fmtStamp } from '../format';
import type { RecordUpdate } from '../types';

const TYPE: Record<RecordUpdate['entryType'], string> = { LAB: 'Lab result', ENCOUNTER: 'Visit', MEDICATION: 'Medication', DOCUMENT: 'Document' };

interface Props {
  updates: RecordUpdate[];
  /** Clinic view: show a "Mark reviewed" button and link to the patient. */
  onReview?: (u: RecordUpdate) => void;
  showClinic?: boolean;
  empty?: string;
}

/** Record updates sent in by clinicians and nurses, pending ones first. */
export default function UpdatesList({ updates, onReview, showClinic = false, empty = 'No updates sent in yet.' }: Props) {
  if (updates.length === 0) return <p className="text-sm text-ink-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-line">
      {updates.map((u) => {
        const pending = !u.reviewedAt;
        return (
          <li key={u.id} className={'flex flex-wrap items-center justify-between gap-3 py-3.5 ' + (pending ? '' : 'opacity-70')}>
            <span className="min-w-0 flex-1">
              <span className="mb-0.5 flex flex-wrap items-center gap-2">
                <span className="rounded bg-canvas px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{TYPE[u.entryType]}</span>
                {onReview ? (
                  <Link to={`/clinic/patients/${u.patientId}`} className="text-[15px] font-semibold hover:text-teal">{u.patientName}</Link>
                ) : (
                  <span className="text-[15px] font-semibold">{u.patientName}</span>
                )}
                <span className="font-mono text-xs text-ink-faint">{u.nationalId}</span>
              </span>
              <span className="block text-sm text-ink-soft">{u.summary}</span>
              <span className="block text-xs text-ink-faint">
                Sent by {u.submittedBy}{showClinic ? ` · ${u.facilityName}` : ''} &middot; {fmtStamp(u.submittedAt)}
                {u.reviewedAt && ` · reviewed by ${u.reviewedBy} ${fmtAgo(u.reviewedAt)}`}
              </span>
            </span>
            {pending ? (
              onReview ? (
                <button onClick={() => onReview(u)} className="rounded-lg border border-teal px-3 py-1.5 text-xs font-semibold text-teal hover:bg-teal-tint">Mark reviewed</button>
              ) : (
                <Badge tone="warn">Awaiting review</Badge>
              )
            ) : (
              <Badge tone="good">Reviewed</Badge>
            )}
          </li>
        );
      })}
    </ul>
  );
}
