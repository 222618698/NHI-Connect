import Badge, { type BadgeTone } from './Badge';
import { EVENT_LABEL, ROLE_LABEL, fmtStamp } from '../format';
import type { AuditRow, Outcome } from '../types';

const TONE: Record<Outcome, BadgeTone> = { SUCCESS: 'good', FLAGGED: 'warn', FAILED: 'bad' };
const OUTCOME_LABEL: Record<Outcome, string> = { SUCCESS: 'Success', FLAGGED: 'Flagged', FAILED: 'Failed' };

export default function AuditTable({ rows, showHospital = true, empty = 'No activity yet.' }: { rows: AuditRow[]; showHospital?: boolean; empty?: string }) {
  const th = 'px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-ink-faint';
  const dash = <span className="text-ink-faint">&mdash;</span>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="border-b border-line">
          <tr>
            <th className={th}>Timestamp</th>
            <th className={th}>User</th>
            <th className={th}>Role</th>
            {showHospital && <th className={th}>Clinic</th>}
            <th className={th}>Event</th>
            <th className={th}>Patient / Target</th>
            <th className={th}>Outcome</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id} className="border-b border-line last:border-0">
              <td className="whitespace-nowrap px-5 py-4 text-ink-muted">{fmtStamp(e.occurredAt)}</td>
              <td className="px-5 py-4">
                <span className="block font-bold">{e.fullName ?? (e.username ? 'Unknown account' : 'Unknown')}</span>
                {e.username && <span className="block font-mono text-xs text-ink-faint">{e.username}</span>}
              </td>
              <td className="px-5 py-4 text-ink-muted">{e.role ? ROLE_LABEL[e.role] : dash}</td>
              {showHospital && <td className="px-5 py-4 text-ink-muted">{e.facilityName ?? dash}</td>}
              <td className="px-5 py-4">{EVENT_LABEL[e.eventType] ?? e.eventType}</td>
              <td className="px-5 py-4 text-ink-soft">
                {e.patientName && <span className="block font-semibold text-ink">{e.patientName}</span>}
                <span className="block">{e.target ?? dash}</span>
              </td>
              <td className="px-5 py-4"><Badge tone={TONE[e.outcome] ?? 'warn'}>{OUTCOME_LABEL[e.outcome] ?? e.outcome}</Badge></td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={showHospital ? 7 : 6} className="px-5 py-10 text-center text-ink-muted">{empty}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
