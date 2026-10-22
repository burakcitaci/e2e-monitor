import { Card, CardContent } from '../../../components/ui/card';

export const StatisticsCards = ({
  stats,
}: {
  stats: { total: number; sqs: number; azureServiceBus: number };
}) => {
  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-1">
            Total Messages
          </div>
          <div className="text-xl font-bold">{stats.total}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-1">SQS</div>
          <div className="text-xl font-bold">{stats.sqs}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Azure SB</div>
          <div className="text-xl font-bold">{stats.azureServiceBus}</div>
        </CardContent>
      </Card>
    </div>
  );
};
