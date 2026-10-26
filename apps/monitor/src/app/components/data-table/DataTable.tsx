import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import * as React from 'react';
import { Download, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '../ui/button';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { DataTablePagination } from './DataTablePagination';
import { DataTableToolbar } from './DataTableToolbar';

function SelectionCheckbox({
  indeterminate = false,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { indeterminate?: boolean }) {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      {...props}
      ref={ref}
      type="checkbox"
      className="size-4 cursor-pointer rounded border-border accent-primary focus-visible:outline-2 focus-visible:outline-ring"
    />
  );
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey?: string;
  searchPlaceholder?: string;
  onAdd?: () => void;
  onRowClick?: (row: TData) => void;
  onDeleteRow?: (row: TData) => Promise<unknown>;
  onEditRow?: (row: TData) => void;
  deleteDescription?: string;
  tableClassName?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = 'Search...',
  onAdd,
  onRowClick,
  onDeleteRow,
  onEditRow,
  deleteDescription = 'This cannot be undone.',
  tableClassName,
}: Readonly<DataTableProps<TData, TValue>>) {
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState('');
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const identities = React.useRef(new WeakMap<object, string>());
  const nextIdentity = React.useRef(0);
  const getRowId = (item: TData, index: number) => {
    if (typeof item !== 'object' || item === null) return `index:${index}`;
    const record = item as Record<string, unknown>;
    const id = record['_id'] ?? record['id'];
    if (typeof id === 'string' || typeof id === 'number') return `id:${id}`;
    let identity = identities.current.get(item);
    if (!identity) {
      identity = `row:${nextIdentity.current++}`;
      identities.current.set(item, identity);
    }
    return identity;
  };

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getRowId,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    enableRowSelection: true,
    enableColumnFilters: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const deleteSelection = async () => {
    if (
      !onDeleteRow ||
      deleting ||
      !window.confirm(
        `Delete ${selectedRows.length} selected rows? ${deleteDescription}`,
      )
    )
      return;
    setDeleting(true);
    setDeleteError('');
    let failures = 0;
    try {
      for (const row of selectedRows) {
        try {
          await onDeleteRow(row.original);
          setRowSelection((selection) => {
            const next = { ...selection } as Record<string, boolean>;
            delete next[row.id];
            return next;
          });
        } catch {
          failures++;
        }
      }
      if (failures)
        setDeleteError(
          `Could not delete ${failures} rows. Failed rows remain selected; please retry.`,
        );
    } finally {
      setDeleting(false);
    }
  };
  const exportSelection = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          selectedRows.map((row) => row.original),
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'selected-rows.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <div className="w-full space-y-2">
      <DataTableToolbar
        table={table}
        searchKey={searchKey}
        searchPlaceholder={searchPlaceholder}
        onAdd={onAdd}
      />
      <div className="rounded-sm border overflow-auto">
        <Table className={tableClassName}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                <TableHead className="w-10 px-3">
                  <SelectionCheckbox
                    aria-label="Select all rows on this page"
                    checked={table.getIsAllPageRowsSelected()}
                    indeterminate={table.getIsSomePageRowsSelected()}
                    disabled={!table.getRowModel().rows.length}
                    onChange={table.getToggleAllPageRowsSelectedHandler()}
                  />
                </TableHead>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      className="h-8 px-3 text-xs font-medium"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  aria-selected={row.getIsSelected()}
                  className={
                    onRowClick
                      ? 'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2'
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={
                    onRowClick
                      ? (event) => {
                          if (
                            (event.target as Element).closest(
                              'a, button, input, select, textarea, [role="button"], [role="menuitem"]',
                            )
                          )
                            return;
                          onRowClick(row.original);
                        }
                      : undefined
                  }
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (
                            event.target !== event.currentTarget ||
                            !['Enter', ' '].includes(event.key)
                          )
                            return;
                          event.preventDefault();
                          onRowClick(row.original);
                        }
                      : undefined
                  }
                >
                  <TableCell className="w-10 px-3 py-1.5">
                    <SelectionCheckbox
                      aria-label={`Select row ${row.index + 1}`}
                      checked={row.getIsSelected()}
                      onChange={row.getToggleSelectedHandler()}
                    />
                  </TableCell>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-1.5 px-3 text-xs">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length + 1}
                  className="h-16 text-center text-xs text-muted-foreground"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
      {deleteError && (
        <p role="alert" className="text-sm text-destructive">
          {deleteError}
        </p>
      )}
      {selectedRows.length > 0 && (
        <div
          className="sticky bottom-4 z-20 mx-auto flex w-fit max-w-full items-center gap-3 rounded-xl border bg-background p-2 shadow-lg"
          role="toolbar"
          aria-label="Selected row actions"
        >
          <span className="pl-2 text-sm font-medium" aria-live="polite">
            {selectedRows.length} selected
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Clear selection"
            disabled={deleting}
            onClick={() => table.resetRowSelection()}
          >
            <X className="size-4" />
          </Button>
          <div className="h-6 border-l" />
          <Button
            variant="outline"
            size="sm"
            aria-label="Export selected"
            onClick={exportSelection}
          >
            <Download className="mr-2 size-4" />
          </Button>
          {onEditRow && selectedRows.length === 1 && (
            <Button
              variant="outline"
              size="sm"
              disabled={deleting}
              onClick={() => onEditRow(selectedRows[0].original)}
              aria-label="Edit selected"
            >
              <Pencil className="mr-2 size-4" />
            </Button>
          )}
          {onDeleteRow && (
            <Button
              variant="destructive"
              size="sm"
              disabled={deleting}
              onClick={() => void deleteSelection()}
              aria-label={
                deleting ? 'Deleting selected rows' : 'Delete selected'
              }
            >
              <Trash2 className="mr-2 size-4" />
              {deleting ? 'Deleting…' : ''}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
