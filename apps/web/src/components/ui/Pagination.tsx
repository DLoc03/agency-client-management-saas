"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/components/shell/Icon";
import { Select } from "./Select";

const DEFAULT_PAGE_SIZES = [10, 20, 30, 50, 100];

type PageItem = number | "start-ellipsis" | "end-ellipsis";

function pageItems(current: number, last: number): PageItem[] {
  if (last <= 7) {
    return Array.from({ length: last }, (_, i) => i + 1);
  }

  const items: PageItem[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(last - 1, current + 1);

  if (start > 2) items.push("start-ellipsis");
  for (let i = start; i <= end; i += 1) items.push(i);
  if (end < last - 1) items.push("end-ellipsis");
  items.push(last);

  return items;
}

export function Pagination({
  page,
  perPage,
  total,
  lastPage,
  onPageChange,
  onPerPageChange,
  disabled = false,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
}: {
  page: number;
  perPage: number;
  total: number;
  lastPage?: number;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
  disabled?: boolean;
  pageSizeOptions?: number[];
}) {
  const t = useTranslations("Common.pagination");
  const c = useTranslations("Common");

  const last = Math.max(1, lastPage ?? Math.ceil(total / perPage));
  const current = Math.min(Math.max(1, page), last);
  const from = total === 0 ? 0 : (current - 1) * perPage + 1;
  const to = total === 0 ? 0 : Math.min(current * perPage, total);

  const buttonCls =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-2.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>{t("showing", { from, to, total })}</span>
        <label className="flex items-center gap-2">
          <span>{t("rowsPerPage")}</span>
          <Select
            value={String(perPage)}
            onValueChange={(value) => onPerPageChange(Number(value))}
            options={pageSizeOptions.map((size) => ({
              value: String(size),
              label: String(size),
            }))}
            disabled={disabled}
            ariaLabel={t("rowsPerPage")}
            className="w-[84px]"
          />
        </label>
      </div>

      <nav
        aria-label={t("page", { page: current, last })}
        className="flex flex-wrap items-center gap-1"
      >
        <button
          type="button"
          aria-label={c("prev")}
          disabled={disabled || current <= 1}
          onClick={() => onPageChange(current - 1)}
          className={`${buttonCls} border-border hover:bg-accent`}
        >
          <Icon name="chevron-left" className="h-4 w-4" />
        </button>

        {pageItems(current, last).map((item) =>
          typeof item === "number" ? (
            <button
              key={item}
              type="button"
              disabled={disabled}
              aria-current={item === current ? "page" : undefined}
              onClick={() => onPageChange(item)}
              className={`${buttonCls} ${
                item === current
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-accent"
              }`}
            >
              {item}
            </button>
          ) : (
            <span
              key={item}
              aria-hidden="true"
              className="inline-flex h-9 min-w-6 items-center justify-center px-1 text-sm text-muted-foreground"
            >
              …
            </span>
          ),
        )}

        <button
          type="button"
          aria-label={c("next")}
          disabled={disabled || current >= last}
          onClick={() => onPageChange(current + 1)}
          className={`${buttonCls} border-border hover:bg-accent`}
        >
          <Icon name="chevron-left" className="h-4 w-4 rotate-180" />
        </button>
      </nav>
    </div>
  );
}
