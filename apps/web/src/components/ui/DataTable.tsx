"use client";

import type { ReactNode } from "react";
import { Skeleton } from "./Skeleton";

/**
 * Desktop data table (DEC-021, UI_GUIDELINES section 3).
 *
 * Modern admin style: hairline row dividers only, sticky header,
 * row hover, and STRICT horizontal control — the table is fixed
 * layout, every column declares its width, and cell content
 * truncates with ellipsis. The table never scrolls sideways;
 * screens must keep core columns at 6 or fewer (plus the kebab
 * action column) and move secondary data to the detail view.
 */
export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  /** Tailwind width class for the column, e.g. "w-[220px]". */
  width?: string;
  /** Extra classes for body cells (alignment, tabular numbers...). */
  cellClassName?: string;
  render: (row: T) => ReactNode;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <table className="w-full table-fixed border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground ${col.width ?? ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`transition-colors hover:bg-accent/50 ${onRowClick ? "cursor-pointer" : ""}`}
            >
              {columns.map((col) => (
                <td key={col.key} className={`px-4 py-3 align-middle ${col.cellClassName ?? ""}`}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Row twins of DataTable while loading (same frame and row height). */
export function DataTableSkeleton({ columns, rows = 6 }: { columns: string[]; rows?: number }) {
  return (
    <div aria-hidden className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <table className="w-full table-fixed border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((w, i) => (
              <th key={i} className={`px-4 py-3 ${w}`}>
                <Skeleton className="h-3 w-16" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {columns.map((_, c) => (
                <td key={c} className="px-4 py-3">
                  <Skeleton className={`h-4 ${c === 0 ? "w-3/4" : "w-1/2"}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
