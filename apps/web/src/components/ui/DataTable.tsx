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
  framed = true,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  /**
   * DEC-022: one data block carries exactly ONE border level. A table
   * standing on its own keeps its card frame (framed, the default);
   * a table inside a section card drops the frame and keeps only the
   * hairline row dividers, with edge cells flush to the section padding.
   */
  framed?: boolean;
}) {
  const edgePad = framed ? "" : "first:pl-0 last:pr-0";
  return (
    <div className={framed ? "overflow-hidden rounded-lg border border-border bg-card shadow-sm" : undefined}>
      <table className="w-full table-fixed border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`overflow-hidden text-ellipsis whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground ${edgePad} ${col.width ?? ""}`}
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
                <td key={col.key} className={`px-4 py-3 align-middle ${edgePad} ${col.cellClassName ?? ""}`}>
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
export function DataTableSkeleton({
  columns,
  rows = 6,
  framed = true,
}: {
  columns: string[];
  rows?: number;
  framed?: boolean;
}) {
  const edgePad = framed ? "" : "first:pl-0 last:pr-0";
  return (
    <div aria-hidden className={framed ? "overflow-hidden rounded-lg border border-border bg-card shadow-sm" : undefined}>
      <table className="w-full table-fixed border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((w, i) => (
              <th key={i} className={`px-4 py-3 ${edgePad} ${w}`}>
                <Skeleton className="h-3 w-16" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {columns.map((_, c) => (
                <td key={c} className={`px-4 py-3 ${edgePad}`}>
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
