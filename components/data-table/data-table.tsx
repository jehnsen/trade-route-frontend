"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type FilterFn,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Columns3 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/overlays";
import { Checkbox } from "@/components/ui/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/form-controls";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/common";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    className?: string;
    headerClassName?: string;
    align?: "right" | "center";
    label?: string;
  }
}

const includesText: FilterFn<unknown> = (row, _columnId, value: string) => {
  if (!value) return true;
  const hay = ((row.original as { __search?: string }).__search ?? JSON.stringify(row.original)).toLowerCase();
  return value
    .toLowerCase()
    .split(/\s+/)
    .every((t) => hay.includes(t));
};

export interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  /** Text used for global search on each row. */
  searchText?: (row: T) => string;
  search?: string;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  toolbar?: React.ReactNode;
  empty?: React.ReactNode;
  initialSorting?: SortingState;
  footer?: React.ReactNode;
  className?: string;
  dense?: boolean;
  rowClassName?: (row: T) => string | undefined;
  columnToggle?: boolean;
  initialHidden?: VisibilityState;
  /** Card representation used below the md breakpoint instead of the table. */
  renderCard?: (row: T) => React.ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  searchText,
  search = "",
  pageSize = 15,
  onRowClick,
  toolbar,
  empty,
  initialSorting = [],
  footer,
  className,
  dense,
  rowClassName,
  columnToggle,
  initialHidden,
  renderCard,
}: DataTableProps<T>) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);
  const [visibility, setVisibility] = React.useState<VisibilityState>(initialHidden ?? {});
  const rows = React.useMemo(() => (searchText ? data.map((d) => Object.assign(Object.create(Object.getPrototypeOf(d)), d, { __search: searchText(d) })) : data), [data, searchText]);
  const table = useReactTable({
    data: rows as T[],
    columns,
    state: { sorting, globalFilter: search, columnVisibility: visibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setVisibility,
    globalFilterFn: includesText as FilterFn<T>,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
    autoResetPageIndex: true,
  });
  const total = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize: ps } = table.getState().pagination;

  return (
    <div className={cn("flex flex-col", className)}>
      {(toolbar || columnToggle) && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1">{toolbar}</div>
          {columnToggle && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="mr-4">
                  <Columns3 /> Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                {table
                  .getAllLeafColumns()
                  .filter((c) => c.getCanHide())
                  .map((c) => (
                    <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                      <Checkbox checked={c.getIsVisible()} onCheckedChange={(v) => c.toggleVisibility(!!v)} />
                      {c.columnDef.meta?.label ?? (typeof c.columnDef.header === "string" ? c.columnDef.header : c.id)}
                    </label>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
      {renderCard && (
        <div className="grid gap-2 p-3 md:hidden">
          {table.getRowModel().rows.length
            ? table.getRowModel().rows.map((row) => (
                <div key={row.id} onClick={onRowClick ? () => onRowClick(row.original) : undefined} className={cn("rounded-lg border bg-card p-3", onRowClick && "cursor-pointer active:bg-muted/50")}>
                  {renderCard(row.original)}
                </div>
              ))
            : (empty ?? <EmptyState title="No matching records" description="Try a different search term or clear the filters." />)}
        </div>
      )}
      <div className={cn(renderCard && "hidden md:block")}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className="hover:bg-transparent">
              {hg.headers.map((h) => {
                const meta = h.column.columnDef.meta;
                const sortable = h.column.getCanSort();
                const dir = h.column.getIsSorted();
                return (
                  <TableHead key={h.id} className={cn(meta?.align === "right" && "text-right", meta?.align === "center" && "text-center", meta?.headerClassName)} aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined}>
                    {h.isPlaceholder ? null : sortable ? (
                      <button type="button" onClick={h.column.getToggleSortingHandler()} className={cn("inline-flex items-center gap-1 hover:text-foreground cursor-pointer", meta?.align === "right" && "flex-row-reverse")}>
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {dir === "asc" ? <ArrowUp className="size-3" /> : dir === "desc" ? <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
                      </button>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={cn(onRowClick && "cursor-pointer", rowClassName?.(row.original))}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta;
                  return (
                    <TableCell key={cell.id} className={cn(dense && "py-2", meta?.align === "right" && "text-right tabular", meta?.align === "center" && "text-center", meta?.className)}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="p-4">
                {empty ?? <EmptyState title="No matching records" description="Try a different search term or clear the filters." />}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        {footer && <TableFooter>{footer}</TableFooter>}
      </Table>
      </div>
      {total > ps && (
        <div className="flex flex-col items-center justify-between gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground sm:flex-row">
          <span className="tabular">
            Showing {pageIndex * ps + 1}–{Math.min(total, (pageIndex + 1) * ps)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">Rows</span>
            <Select value={String(ps)} onValueChange={(v) => table.setPageSize(Number(v))}>
              <SelectTrigger size="sm" className="w-[72px]" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 15, 25, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">
              <ChevronLeft />
            </Button>
            <span className="tabular">
              {pageIndex + 1} / {table.getPageCount()}
            </span>
            <Button variant="outline" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
