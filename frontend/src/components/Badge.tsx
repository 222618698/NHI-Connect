const TONES = {
  good: 'bg-teal-tint text-teal',
  warn: 'bg-amber-tint text-[#B07A12]',
  bad: 'bg-[#FBE7E7] text-[#B23B3B]',
} as const;

export type BadgeTone = keyof typeof TONES;

export default function Badge({ tone, children }: { tone: BadgeTone; children: string }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${TONES[tone]}`}>{children}</span>;
}
