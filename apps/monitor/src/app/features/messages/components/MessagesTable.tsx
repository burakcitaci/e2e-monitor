import { Row } from '@tanstack/react-table';
import React from 'react';
import { DataTable } from '../../../components/data-table';
import { TrackingMessage } from '@e2e-monitor/entities';
import { createColumns } from './Columns';


interface MessagesTableProps {
  messages: TrackingMessage[] | undefined;
}

export const MessagesTable: React.FC<MessagesTableProps> = ({
  messages,
}) => {
  // Ensure messages is always an array - wrapped in useMemo to fix ESLint warning
  const safeMessages = React.useMemo(() => messages || [], [messages]);

  // Memoize filter options to avoid recalculation on every render
  const filterOptions = React.useMemo(() => {
    const sentByOptions = Array.from(
      new Set(safeMessages.map(m => m.sentBy).filter((v): v is string => Boolean(v)))
    ).map(value => ({ label: value, value }));

    const receivedByOptions = Array.from(
      new Set(safeMessages.map(m => m.receivedBy).filter((v): v is string => Boolean(v)))
    ).map(value => ({ label: value, value }));

    const emulatorTypeOptions = Array.from(
      new Set(safeMessages.map(m => m.emulatorType).filter((v): v is 'sqs' | 'azure-service-bus' => Boolean(v)))
    ).map((value: 'sqs' | 'azure-service-bus') => ({
      label: value === 'azure-service-bus' ? 'Azure Service Bus' :
             value === 'sqs' ? 'SQS' : value,
      value
    }));

    return { sentByOptions, receivedByOptions, emulatorTypeOptions };
  }, [safeMessages]);

  // Memoize filter functions to prevent unnecessary re-renders
  const sentByFilterFn = React.useCallback((row: Row<TrackingMessage>, id: string, value: unknown) => {
    if (!value || !Array.isArray(value)) return true;
    return value.includes(row.original.sentBy);
  }, []);

  const receivedByFilterFn = React.useCallback((row: Row<TrackingMessage>, id: string, value: unknown) => {
    if (!value || !Array.isArray(value)) return true;
    return value.includes(row.original.receivedBy);
  }, []);

  const emulatorTypeFilterFn = React.useCallback((row: Row<TrackingMessage>, id: string, value: unknown) => {
    if (!value) return true;
    if (Array.isArray(value)) return value.includes(row.original.emulatorType);

    return String(row.original.emulatorType ?? '')
      .toLowerCase()
      .includes(String(value).toLowerCase());
  }, []);

  const statusFilterFn = React.useCallback((row: Row<TrackingMessage>, id: string, value: unknown) => {
    if (!value || !Array.isArray(value)) return true;
    return value.includes(row.original.status);
  }, []);

  const columns = React.useMemo(
    () =>
      createColumns(

        filterOptions.sentByOptions,
        filterOptions.receivedByOptions,
        filterOptions.emulatorTypeOptions,
        sentByFilterFn,
        receivedByFilterFn,
        emulatorTypeFilterFn,
        statusFilterFn,
       
      ),
    [
      filterOptions.sentByOptions,
      filterOptions.receivedByOptions,
      filterOptions.emulatorTypeOptions,
      sentByFilterFn,
      receivedByFilterFn,
      emulatorTypeFilterFn,
      statusFilterFn,
    ],
  );

  return (
    <div className="w-full min-w-0 flex-1 min-h-0">
      <DataTable
        columns={columns}
        data={safeMessages}
        searchKey="body"
        searchPlaceholder="Search message body..."
      />
    </div>
  );
};
