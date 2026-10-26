import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../DataTable';

interface TestData {
  id: string;
  name: string;
  status: string;
}

const mockColumns: ColumnDef<TestData>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    enableColumnFilter: true,
    filterFn: (row, id, value) => {
      if (!value || !Array.isArray(value)) return true;
      return value.includes(row.original.status);
    },
    meta: {
      variant: 'multiSelect',
      label: 'Status',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
      ],
    },
  },
];

const mockData: TestData[] = [
  { id: '1', name: 'Item 1', status: 'active' },
  { id: '2', name: 'Item 2', status: 'inactive' },
  { id: '3', name: 'Item 3', status: 'active' },
];

describe('DataTable', () => {
  it('should render table with data', () => {
    render(
      <DataTable
        columns={mockColumns}
        data={mockData}
        searchKey="name"
        searchPlaceholder="Search items..."
      />,
    );

    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Item 3')).toBeInTheDocument();
  });

  it('should show "No results" when data is empty', () => {
    render(
      <DataTable
        columns={mockColumns}
        data={[]}
        searchKey="name"
        searchPlaceholder="Search items..."
      />,
    );

    expect(screen.getByText('No results.')).toBeInTheDocument();
  });

  it('should filter data based on search input', async () => {
    const user = userEvent.setup();

    render(
      <DataTable
        columns={mockColumns}
        data={mockData}
        searchKey="name"
        searchPlaceholder="Search items..."
      />,
    );

    const searchInput = screen.getByPlaceholderText('Search items...');
    await user.type(searchInput, 'Item 1');

    await waitFor(() => {
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.queryByText('Item 2')).not.toBeInTheDocument();
      expect(screen.queryByText('Item 3')).not.toBeInTheDocument();
    });
  });

  it('should display pagination controls with multiple pages', () => {
    const largeData = Array.from({ length: 25 }, (_, i) => ({
      id: `${i}`,
      name: `Item ${i}`,
      status: i % 2 === 0 ? 'active' : 'inactive',
    }));

    render(
      <DataTable
        columns={mockColumns}
        data={largeData}
        searchKey="name"
        searchPlaceholder="Search items..."
      />,
    );

    // Check for pagination text or next/previous buttons
    const paginationText = screen.queryByText(/Page \d+ of \d+/);
    const nextButton = screen.queryByRole('button', { name: /next/i });

    expect(paginationText || nextButton).toBeTruthy();
  });
});
it('selects rows without opening them and clears the selection', async () => {
  const user = userEvent.setup();
  const onRowClick = vi.fn();
  render(
    <DataTable columns={mockColumns} data={mockData} onRowClick={onRowClick} />,
  );
  await user.click(screen.getByRole('checkbox', { name: 'Select row 1' }));
  expect(onRowClick).not.toHaveBeenCalled();
  expect(
    screen.getByRole('checkbox', { name: 'Select all rows on this page' }),
  ).toBePartiallyChecked();
  expect(
    screen.getByRole('toolbar', { name: 'Selected row actions' }),
  ).toHaveTextContent('1 selected');
  await user.click(screen.getByRole('button', { name: 'Clear selection' }));
  expect(
    screen.queryByRole('toolbar', { name: 'Selected row actions' }),
  ).not.toBeInTheDocument();
});

it('selects only the current page and preserves selection by identity after reordering', async () => {
  const user = userEvent.setup();
  const data = Array.from({ length: 12 }, (_, i) => ({
    id: String(i),
    name: `Item ${i}`,
    status: 'active',
  }));
  const { rerender } = render(<DataTable columns={mockColumns} data={data} />);
  await user.click(
    screen.getByRole('checkbox', { name: 'Select all rows on this page' }),
  );
  expect(screen.getByRole('toolbar')).toHaveTextContent('10 selected');
  await user.click(screen.getByRole('button', { name: 'Go to next page' }));
  expect(
    screen.getByRole('checkbox', { name: 'Select row 11' }),
  ).not.toBeChecked();
  rerender(<DataTable columns={mockColumns} data={[...data].reverse()} />);
  expect(screen.getByRole('toolbar')).toHaveTextContent('10 selected');
  expect(screen.getByRole('checkbox', { name: 'Select row 11' })).toBeChecked();
});

it('confirms bulk deletion and retains only failed rows for retry', async () => {
  const user = userEvent.setup();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const onDeleteRow = vi
    .fn()
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error('Failed'))
    .mockResolvedValueOnce(undefined);
  render(
    <DataTable
      columns={mockColumns}
      data={mockData}
      onDeleteRow={onDeleteRow}
    />,
  );
  await user.click(
    screen.getByRole('checkbox', { name: 'Select all rows on this page' }),
  );
  await user.click(screen.getByRole('button', { name: 'Delete selected' }));
  expect(onDeleteRow).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  await user.click(screen.getByRole('button', { name: 'Delete selected' }));
  await waitFor(() => expect(onDeleteRow).toHaveBeenCalledTimes(3));
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Could not delete 1 rows',
  );
  expect(
    screen.getByRole('checkbox', { name: 'Select row 1' }),
  ).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Select row 2' })).toBeChecked();
  expect(
    screen.getByRole('checkbox', { name: 'Select row 3' }),
  ).not.toBeChecked();
  onDeleteRow.mockResolvedValue(undefined);
  await user.click(screen.getByRole('button', { name: 'Delete selected' }));
  await waitFor(() =>
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument(),
  );
  expect(onDeleteRow).toHaveBeenLastCalledWith(mockData[1]);
  confirm.mockRestore();
});
