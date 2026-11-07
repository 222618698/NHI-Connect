import type { ReactNode } from 'react';

/** Small shared UI pieces used across the portals. */

export function StatTile({ label, value, tone }: { label: string; value: number | string; tone?: 'warn' | 'bad' }) {
  const colour = tone === 'bad' ? 'text-[#B23B3B]' : tone === 'warn' ? 'text-[#B07A12]' : 'text-ink';
  return (
    <div className="rounded-2xl border border-line bg-white px-5 py-4">
      <p className="text-[13px] text-ink-muted">{label}</p>
      <p className={`mt-1 text-[26px] font-bold ${colour}`}>{value}</p>
    </div>
  );
}

export function PageHeading({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="mb-1 text-[26px] font-bold">{title}</h2>
        {sub && <p className="text-[15px] text-ink-muted">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

export function Card({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-6 sm:p-7">
      {(title || action) && (
        <div className="mb-5 flex items-center justify-between gap-3">
          {title && <h3 className="text-base font-bold">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return <p role="alert" className="rounded-lg border border-[#F0C9C9] bg-[#FBE7E7] px-4 py-2.5 text-[13px] text-[#9C3B3B]">{children}</p>;
}

export function SuccessBox({ children }: { children: ReactNode }) {
  return <p role="status" className="rounded-lg bg-teal-tint px-4 py-2.5 text-[13px] font-semibold text-teal">{children}</p>;
}

export const inputCls = 'w-full rounded-lg border border-[#D6DFE6] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-teal';
export const labelCls = 'mb-1.5 block text-[13px] font-semibold text-ink-soft';
export const primaryBtn = 'rounded-lg bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-dark disabled:cursor-not-allowed disabled:opacity-50';
export const secondaryBtn = 'rounded-lg border border-[#D6DFE6] bg-white px-4 py-2.5 text-sm font-semibold text-ink-muted hover:bg-canvas disabled:opacity-50';

export function Field({ label, htmlFor, children, className = '' }: { label: string; htmlFor: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className={labelCls}>{label}</label>
      {children}
    </div>
  );
}
