import type { ReactNode } from 'react';
import { Page } from './Page';

export function DetailPage({ children }: { children: ReactNode }) {
  return <Page contained>{children}</Page>;
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
