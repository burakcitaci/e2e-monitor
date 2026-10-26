import type { Row } from '@tanstack/react-table';
import React from 'react';
import { DataTable } from '../../../components/data-table';
import type { TrackingMessage } from '@e2e-monitor/entities';
import { createColumns } from './Columns';
import { useNavigate } from 'react-router';
import { messageDetailPath } from '../message-presentation';
import { useDeleteTrackingMessage } from '../../../hooks/api/tracking-messages';

export const MessagesTable = ({
  messages,
}: {
  messages: TrackingMessage[] | undefined;
}) => {
  const navigate = useNavigate();
  const deleteMessage = useDeleteTrackingMessage();
  const safeMessages = React.useMemo(() => messages ?? [], [messages]);
  const publishers = React.useMemo(
    () =>
      Array.from(
        new Set(safeMessages.map((message) => message.sentBy).filter(Boolean)),
      ).map((value) => ({ label: value, value })),
    [safeMessages],
  );
  const sentByFilterFn = React.useCallback(
    (row: Row<TrackingMessage>, _id: string, value: unknown) =>
      !Array.isArray(value) || value.includes(row.original.sentBy),
    [],
  );
  const statusFilterFn = React.useCallback(
    (row: Row<TrackingMessage>, id: string, value: unknown) =>
      !Array.isArray(value) || value.includes(row.getValue(id)),
    [],
  );
  const columns = React.useMemo(
    () => createColumns(publishers, sentByFilterFn, statusFilterFn),
    [publishers, sentByFilterFn, statusFilterFn],
  );
  return (
    <div className="w-full min-w-0 flex-1 min-h-0">
      <DataTable
        columns={columns}
        data={safeMessages}
        searchKey="body"
        searchPlaceholder="Search message body..."
        onRowClick={(message) => navigate(messageDetailPath(message))}
        onDeleteRow={(message) => deleteMessage.mutateAsync(message._id)}
      />
    </div>
  );
};
