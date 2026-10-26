import { StatisticsCards as SharedStatisticsCards } from '../../../components/common/StatisticsCards';

export const StatisticsCards = ({
  stats,
}: {
  stats: { total: number; sqs: number; sns: number; azureServiceBus: number };
}) => {
  return (
    <SharedStatisticsCards
      items={[
        { label: 'Total Messages', value: stats.total },
        { label: 'SQS', value: stats.sqs },
        { label: 'SNS', value: stats.sns },
        { label: 'Azure SB', value: stats.azureServiceBus },
      ]}
    />
  );
};
