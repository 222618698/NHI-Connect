import { useState } from 'react';
import Badge from '../components/Badge';
import type { CodeMapping } from './data';

interface Props {
  rows: CodeMapping[];
  onMap: (localCode: string, standardCode: string) => void;
}

export default function MappingTable({ rows, onMap }: Props) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-white px-6 py-10 text-center text-sm text-ink-muted">
        No local codes received yet. Codes appear here after the facility&apos;s first test extract.
      </div>
    );
  }

  const save = (code: string) => {
    const value = (drafts[code] ?? '').trim();
    if (!value) return;
    onMap(code, value);
    setDrafts((d) => ({ ...d, [code]: '' }));
  };

  const th = 'px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-ink-faint';
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="border-b border-line">
          <tr>
            <th className={th}>Local Code</th>
            <th className={th}>Local Description</th>
            <th className={th}>Type</th>
            <th className={th}>Standard Code (FHIR)</th>
            <th className={th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const pending = !r.standardCode;
            return (
              <tr key={r.localCode} className={'border-b border-line last:border-0 ' + (pending ? 'bg-[#FFFAF0]' : '')}>
                <td className="px-5 py-4 font-bold">{r.localCode}</td>
                <td className="px-5 py-4 text-ink-soft">{r.localDescription}</td>
                <td className="px-5 py-4 text-ink-muted">{r.type}</td>
                <td className="px-5 py-4">
                  {pending ? (
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => { e.preventDefault(); save(r.localCode); }}
                    >
                      <input
                        value={drafts[r.localCode] ?? ''}
                        onChange={(e) => setDrafts((d) => ({ ...d, [r.localCode]: e.target.value }))}
                        placeholder={r.type === 'Diagnosis' ? 'e.g. ICD-10 J18.9' : 'Standard code'}
                        aria-label={`Standard code for ${r.localCode}`}
                        className="w-40 min-w-0 rounded-md border border-[#D6DFE6] bg-white px-2.5 py-1.5 text-sm outline-none focus:border-teal"
                      />
                      <button type="submit" className="rounded-md bg-teal px-3 text-xs font-semibold text-white hover:bg-teal-dark">Map</button>
                    </form>
                  ) : (
                    r.standardCode
                  )}
                </td>
                <td className="px-5 py-4"><Badge tone={pending ? 'warn' : 'good'}>{pending ? 'Pending' : 'Mapped'}</Badge></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
