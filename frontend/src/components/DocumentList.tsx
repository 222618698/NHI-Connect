import { useState } from 'react';
import { api } from '../api';
import { fmtBytes, fmtShort } from '../format';
import type { PatientDocument } from '../types';

const ICON: Record<string, string> = { 'application/pdf': 'PDF', 'image/png': 'PNG', 'image/jpeg': 'JPG', 'text/plain': 'TXT' };

/** Lists a patient's documents. Opening one fetches it with the user's token, then shows it in a new tab. */
export default function DocumentList({ docs }: { docs: PatientDocument[] }) {
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = async (d: PatientDocument) => {
    setOpening(d.id);
    setError(null);
    // Open the tab now (inside the click) so pop-up blockers allow it, then point it at the file.
    const tab = window.open('', '_blank');
    try {
      const blob = await api.downloadDocument(d.id);
      const url = URL.createObjectURL(blob);
      if (tab) tab.location.href = url;
      else {
        const a = document.createElement('a');
        a.href = url;
        a.download = d.fileName;
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      tab?.close();
      setError((e as Error).message);
    } finally {
      setOpening(null);
    }
  };

  if (docs.length === 0) return <p className="text-sm text-ink-muted">No documents uploaded for this patient yet.</p>;

  return (
    <div>
      {error && <p className="mb-3 text-[13px] text-[#9C3B3B]">{error}</p>}
      <ul className="flex flex-col gap-2">
        {docs.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => open(d)}
              className="flex w-full items-center gap-4 rounded-xl border border-line bg-white px-4 py-3 text-left hover:border-teal"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-tint text-[11px] font-bold text-teal">
                {ICON[d.contentType] ?? 'FILE'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{d.fileName}</span>
                <span className="block truncate text-xs text-ink-muted">
                  {d.description ? `${d.description} · ` : ''}{d.facilityName} &middot; {d.uploadedBy} &middot; {fmtShort(d.uploadedAt)} &middot; {fmtBytes(d.sizeBytes)}
                </span>
              </span>
              <span className="shrink-0 text-[13px] font-semibold text-teal">{opening === d.id ? 'Opening…' : 'Open'}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
