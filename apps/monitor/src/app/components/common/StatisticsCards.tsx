import { Card, CardContent } from '../ui/card';

export interface Statistic {
  label: string;
  value: number;
}

export function StatisticsCards({ items }: { items: Statistic[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-4">
            <div className="mb-1 text-xs text-muted-foreground">
              {item.label}
            </div>
            <div className="text-xl font-bold">{item.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
