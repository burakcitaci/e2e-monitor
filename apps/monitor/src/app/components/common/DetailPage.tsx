import type { ReactNode } from 'react';

export function DetailPage({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6 p-4 text-sm md:p-6 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm">
      {children}
    </div>
  );
}

export function DetailStat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <section aria-label={label} className="rounded-xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
    </section>
  );
}
