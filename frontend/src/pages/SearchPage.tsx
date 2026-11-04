import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { api, NotFoundError } from '../api';

const RECENT = [{ name: 'Bongani Mahlangu', idNumber: '8801015800083' }];

export default function SearchPage() {
  const navigate = useNavigate();
  const [idNumber, setIdNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const search = async (id: string) => {
    setError(null);
    if (!/^\d{13}$/.test(id)) {
      setError('Enter a 13-digit South African ID number.');
      return;
    }
    setLoading(true);
    try {
      const patient = await api.searchById(id);
      navigate(`/patients/${patient.patientId}`);
    } catch (e) {
      setError(e instanceof NotFoundError ? `No patient found for ID "${id}". Check the number and try again.` : 'Could not reach NHI-Connect. Try again shortly.');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: FormEvent) => { e.preventDefault(); search(idNumber); };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-[640px] px-6 py-16">
        <h1 className="mb-2 text-[26px] font-bold">Find a patient by ID number</h1>
        <p className="mb-7 text-[15px] text-ink-muted">
          Enter a patient&apos;s 13-digit South African ID number to retrieve their <b>complete medical history from every connected hospital nationwide</b>.
        </p>

        <form onSubmit={onSubmit} className="mb-2 flex gap-2.5">
          <input
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, '').slice(0, 13))}
            inputMode="numeric"
            placeholder="e.g. 8801015800083"
            className="min-w-0 flex-1 rounded-xl border border-[#D6DFE6] px-4 py-3.5 text-base tracking-wide outline-none focus:border-teal"
          />
          <button type="submit" disabled={loading} className="rounded-xl bg-teal px-6 text-[15px] font-semibold text-white hover:bg-teal-dark disabled:opacity-60">
            {loading ? 'Searching\u2026' : 'Search'}
          </button>
        </form>

        {error && <div className="mt-1.5 rounded-lg border border-[#F0C9C9] bg-[#FBE7E7] px-4 py-3 text-[13px] text-[#9C3B3B]">{error}</div>}

        <h2 className="mb-3 mt-8 text-[13px] font-semibold uppercase tracking-wider text-ink-faint">Recent Searches</h2>
        <div className="flex flex-col gap-2.5">
          {RECENT.map((r) => (
            <button key={r.idNumber} onClick={() => search(r.idNumber)} className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-4 text-left hover:border-teal">
              <span>
                <span className="mb-0.5 block text-[15px] font-semibold">{r.name}</span>
                <span className="block font-mono text-[13px] text-ink-muted">ID {r.idNumber}</span>
              </span>
              <span className="text-lg text-[#B8C1C9]">&rarr;</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
