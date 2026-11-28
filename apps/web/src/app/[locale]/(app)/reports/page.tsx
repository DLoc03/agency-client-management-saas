"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useRouter } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { Icon } from "@/components/shell/Icon";
import { DataTable, DataTableSkeleton } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Forbidden, isForbiddenError } from "@/components/ui/Forbidden";
import { Skeleton, useDelayedSkeleton } from "@/components/ui/Skeleton";
import {
  getRevenueReport,
  revenueExportUrl,
  listProjectsReport,
  listClientsReport,
} from "@/lib/reports/api";
import type {
  RevenueReport,
  ProjectReportRow,
  ClientReportRow,
} from "@/lib/reports/types";
import { statusBadgeClass } from "@/lib/status-colors";
import { formatMoney } from "@/lib/currency";

const TABS = ["revenue", "projects", "clients"] as const;
type TabKey = (typeof TABS)[number];

function permissionFor(tab: TabKey): string {
  if (tab === "revenue") return "invoices.view";
  if (tab === "projects") return "projects.view";
  return "clients.view";
}

export default function ReportsPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-sm text-muted-foreground">…</p>
        </div>
      }
    >
      <ReportsPage />
    </Suspense>
  );
}

function ReportsPage() {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("Reports");
  const tProjects = useTranslations("Projects");
  const tClients = useTranslations("Clients");
  const c = useTranslations("Common");

  const [hiddenTabs, setHiddenTabs] = useState<Set<TabKey>>(new Set());

  useEffect(() => {
    if (!isLoading && !session) router.replace("/login");
  }, [isLoading, session, router]);

  const allowedTabs = TABS.filter(
    (tab) =>
      !!session?.user.permissions.includes(permissionFor(tab)) &&
      !hiddenTabs.has(tab),
  );

  const requested = searchParams.get("tab") as TabKey | null;
  const initialTab =
    requested && allowedTabs.includes(requested) ? requested : allowedTabs[0];
  const [activeTab, setActiveTab] = useState<TabKey | undefined>(initialTab);

  useEffect(() => {
    if (allowedTabs.length === 0) return;
    if (!activeTab || !allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0]);
    }
  }, [allowedTabs, activeTab]);

  if (isLoading || !session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">{c("loading")}</p>
      </div>
    );
  }

  if (allowedTabs.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Forbidden />
      </div>
    );
  }

  const currency = session.agency.base_currency || "USD";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border">
        {allowedTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(`tabs.${tab}`)}
          </button>
        ))}
      </div>

      {activeTab === "revenue" && (
        <RevenueTab
          t={t}
          c={c}
          currency={currency}
          locale={locale}
          onForbidden={() => setHiddenTabs((prev) => new Set(prev).add("revenue"))}
        />
      )}
      {activeTab === "projects" && (
        <ProjectsTab
          t={t}
          tProjects={tProjects}
          c={c}
          currency={currency}
          locale={locale}
          onForbidden={() => setHiddenTabs((prev) => new Set(prev).add("projects"))}
        />
      )}
      {activeTab === "clients" && (
        <ClientsTab
          t={t}
          tClients={tClients}
          c={c}
          currency={currency}
          locale={locale}
          onForbidden={() => setHiddenTabs((prev) => new Set(prev).add("clients"))}
        />
      )}
    </div>
  );
}

function RevenueTab({
  t,
  c,
  currency,
  locale,
  onForbidden,
}: {
  t: ReturnType<typeof useTranslations>;
  c: ReturnType<typeof useTranslations>;
  currency: string;
  locale: string;
  onForbidden: () => void;
}) {
  const [data, setData] = useState<RevenueReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applying, setApplying] = useState(false);

  const load = async (params?: { from?: string; to?: string }) => {
    setLoading(true);
    setError(null);
    setFormError(null);
    try {
      const res = await getRevenueReport(params);
      setData(res);
      setFrom(res.from);
      setTo(res.to);
      setHasLoaded(true);
    } catch (e) {
      if (isForbiddenError(e)) {
        onForbidden();
        return;
      }
      const err = e as { status?: number };
      if (err.status === 422) {
        setFormError(e instanceof Error ? e.message : t("revenue.errors.invalidRange"));
      } else {
        setError(e instanceof Error ? e.message : t("revenue.errors.loadFailed"));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showSkeleton = useDelayedSkeleton(loading && !hasLoaded);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setApplying(true);
    await load({ from: from || undefined, to: to || undefined });
    setApplying(false);
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleApply}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4 shadow-sm"
      >
        <div>
          <label className="mb-1 block text-sm font-medium">{t("revenue.from")}</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("revenue.to")}</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={applying || loading}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <Icon name="check" className="h-4 w-4" />
          {t("revenue.apply")}
        </button>
        {data && (
          <a
            href={revenueExportUrl({ from: data.from, to: data.to })}
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <Icon name="download" className="h-4 w-4" />
            {t("revenue.exportCsv")}
          </a>
        )}
      </form>

      {formError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && !hasLoaded ? (
        showSkeleton ? (
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="min-h-[240px]" />
        )
      ) : data ? (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <table className="w-full table-fixed border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("revenue.month")}
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("revenue.invoiced")}
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("revenue.collected")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.months.map((m) => (
                  <tr key={m.month}>
                    <td className="px-4 py-3">{m.month}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatMoney(m.invoiced, currency, locale) || "0"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatMoney(m.collected, currency, locale) || "0"}
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="px-4 py-3">{t("revenue.total")}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoney(data.totals.invoiced, currency, locale) || "0"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoney(data.totals.collected, currency, locale) || "0"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("revenue.outstandingCard")}
            </div>
            <div className="mt-2 text-2xl font-bold tabular-nums text-foreground">
              {formatMoney(data.outstanding_total, currency, locale) || "0"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {t("revenue.outstandingNote")}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProjectsTab({
  t,
  tProjects,
  c,
  currency,
  locale,
  onForbidden,
}: {
  t: ReturnType<typeof useTranslations>;
  tProjects: ReturnType<typeof useTranslations>;
  c: ReturnType<typeof useTranslations>;
  currency: string;
  locale: string;
  onForbidden: () => void;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<ProjectReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [perPage] = useState(100);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listProjectsReport({ page, per_page: perPage });
      setRows(res.data || []);
      setTotal(res.meta?.total ?? res.data?.length ?? 0);
      setLastPage(res.meta?.last_page ?? 1);
      setHasLoaded(true);
    } catch (e) {
      if (isForbiddenError(e)) {
        onForbidden();
        return;
      }
      setError(e instanceof Error ? e.message : t("projects.errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const showSkeleton = useDelayedSkeleton(loading && !hasLoaded);

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="min-h-[320px]">
        {loading && !hasLoaded ? (
          showSkeleton ? (
            <>
              <div className="hidden lg:block">
                <DataTableSkeleton
                  columns={["w-[18%]", "w-[14%]", "w-[10%]", "w-[14%]", "w-[11%]", "w-[11%]", "w-[11%]", "w-[11%]"]}
                />
              </div>
              <div className="lg:hidden">
                <div className="grid gap-4 sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                      <Skeleton className="h-5 w-2/3" />
                      <Skeleton className="mt-3 h-4 w-1/3" />
                      <Skeleton className="mt-3 h-4 w-5/6" />
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="min-h-[240px]" />
          )
        ) : rows.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
            <Icon name="folder-kanban" className="mb-3 h-8 w-8 text-muted-foreground" />
            <h3 className="text-base font-semibold text-foreground">{t("empty.title")}</h3>
          </div>
        ) : (
          <div aria-busy={loading} className={loading ? "pointer-events-none opacity-60 transition-opacity" : undefined}>
            <div className="hidden lg:block">
              <DataTable
                columns={[
                  {
                    key: "name",
                    header: t("projects.project"),
                    width: "w-[18%]",
                    render: (r) => <span className="block truncate font-medium text-foreground">{r.name}</span>,
                  },
                  {
                    key: "client",
                    header: t("projects.client"),
                    width: "w-[14%]",
                    render: (r) => <span className="block truncate">{r.client?.name ?? "—"}</span>,
                  },
                  {
                    key: "status",
                    header: t("projects.status"),
                    width: "w-[10%]",
                    render: (r) => (
                      <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(r.status)}`}>
                        {tProjects(`statuses.${r.status}`)}
                      </span>
                    ),
                  },
                  {
                    key: "progress",
                    header: t("projects.progress"),
                    width: "w-[14%]",
                    render: (r) => {
                      const pct = r.progress_percent ?? 0;
                      return (
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-16 overflow-hidden rounded-full bg-secondary">
                            <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
                          </span>
                          <span className="text-xs font-medium tabular-nums">{pct}%</span>
                        </span>
                      );
                    },
                  },
                  {
                    key: "due",
                    header: t("projects.dueDate"),
                    width: "w-[11%]",
                    render: (r) => (
                      <span className={`block truncate tabular-nums ${r.is_overdue ? "text-red-600 font-medium" : ""}`}>
                        {r.due_date ? new Date(r.due_date).toLocaleDateString(locale) : "—"}
                        {r.is_overdue && (
                          <span className="ml-1 whitespace-nowrap rounded-full border border-red-200 bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-800">
                            {t("projects.overdue")}
                          </span>
                        )}
                      </span>
                    ),
                  },
                  {
                    key: "budget",
                    header: t("projects.budget"),
                    width: "w-[11%]",
                    cellClassName: "text-right tabular-nums",
                    render: (r) => formatMoney(r.budget, currency, locale) || "—",
                  },
                  {
                    key: "invoiced",
                    header: t("projects.invoiced"),
                    width: "w-[11%]",
                    cellClassName: "text-right tabular-nums",
                    render: (r) => formatMoney(r.invoiced_total, currency, locale) || "0",
                  },
                  {
                    key: "collected",
                    header: t("projects.collected"),
                    width: "w-[11%]",
                    cellClassName: "text-right tabular-nums",
                    render: (r) => formatMoney(r.collected_total, currency, locale) || "0",
                  },
                ]}
                rows={rows}
                rowKey={(r) => r.id}
                onRowClick={(r) => router.push(`/projects/${r.id}`)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
              {rows.map((r) => {
                const pct = r.progress_percent ?? 0;
                return (
                  <div
                    key={r.id}
                    onClick={() => router.push(`/projects/${r.id}`)}
                    className="flex cursor-pointer flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-foreground">{r.name}</h3>
                        <p className="truncate text-xs text-muted-foreground">{r.client?.name ?? "—"}</p>
                      </div>
                      <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(r.status)}`}>
                        {tProjects(`statuses.${r.status}`)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-24 overflow-hidden rounded-full bg-secondary">
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
                      </span>
                      <span className="text-xs font-medium tabular-nums">{pct}%</span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {r.due_date && (
                        <span className={r.is_overdue ? "text-red-600 font-medium" : ""}>
                          {new Date(r.due_date).toLocaleDateString(locale)}
                          {r.is_overdue ? ` · ${t("projects.overdue")}` : ""}
                        </span>
                      )}
                    </div>
                    <dl className="space-y-1 text-sm">
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">{t("projects.budget")}</dt>
                        <dd className="tabular-nums">{formatMoney(r.budget, currency, locale) || "—"}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">{t("projects.invoiced")}</dt>
                        <dd className="tabular-nums">{formatMoney(r.invoiced_total, currency, locale) || "0"}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">{t("projects.collected")}</dt>
                        <dd className="tabular-nums">{formatMoney(r.collected_total, currency, locale) || "0"}</dd>
                      </div>
                    </dl>
                  </div>
                );
              })}
            </div>
            {total > perPage && (
              <div className="mt-6">
                <Pagination
                  page={page}
                  perPage={perPage}
                  total={total}
                  lastPage={lastPage}
                  onPageChange={setPage}
                  onPerPageChange={() => {}}
                  disabled={loading}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ClientsTab({
  t,
  tClients,
  c,
  currency,
  locale,
  onForbidden,
}: {
  t: ReturnType<typeof useTranslations>;
  tClients: ReturnType<typeof useTranslations>;
  c: ReturnType<typeof useTranslations>;
  currency: string;
  locale: string;
  onForbidden: () => void;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<ClientReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [perPage] = useState(100);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listClientsReport({ page, per_page: perPage });
      setRows(res.data || []);
      setTotal(res.meta?.total ?? res.data?.length ?? 0);
      setLastPage(res.meta?.last_page ?? 1);
      setHasLoaded(true);
    } catch (e) {
      if (isForbiddenError(e)) {
        onForbidden();
        return;
      }
      setError(e instanceof Error ? e.message : t("clients.errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const showSkeleton = useDelayedSkeleton(loading && !hasLoaded);

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="min-h-[320px]">
        {loading && !hasLoaded ? (
          showSkeleton ? (
            <>
              <div className="hidden lg:block">
                <DataTableSkeleton columns={["w-[24%]", "w-[12%]", "w-[10%]", "w-[18%]", "w-[18%]", "w-[18%]"]} />
              </div>
              <div className="lg:hidden">
                <div className="grid gap-4 sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                      <Skeleton className="h-5 w-2/3" />
                      <Skeleton className="mt-3 h-4 w-1/3" />
                      <Skeleton className="mt-3 h-4 w-5/6" />
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="min-h-[240px]" />
          )
        ) : rows.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
            <Icon name="building-2" className="mb-3 h-8 w-8 text-muted-foreground" />
            <h3 className="text-base font-semibold text-foreground">{t("empty.title")}</h3>
          </div>
        ) : (
          <div aria-busy={loading} className={loading ? "pointer-events-none opacity-60 transition-opacity" : undefined}>
            <div className="hidden lg:block">
              <DataTable
                columns={[
                  {
                    key: "name",
                    header: t("clients.client"),
                    width: "w-[24%]",
                    render: (r) => <span className="block truncate font-medium text-foreground">{r.name}</span>,
                  },
                  {
                    key: "status",
                    header: t("clients.status"),
                    width: "w-[12%]",
                    render: (r) => (
                      <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(r.status)}`}>
                        {tClients(`statuses.${r.status}`)}
                      </span>
                    ),
                  },
                  {
                    key: "projects",
                    header: t("clients.projectsCount"),
                    width: "w-[10%]",
                    cellClassName: "tabular-nums",
                    render: (r) => r.projects_count,
                  },
                  {
                    key: "invoiced",
                    header: t("clients.invoiced"),
                    width: "w-[18%]",
                    cellClassName: "text-right tabular-nums",
                    render: (r) => formatMoney(r.invoiced_total, currency, locale) || "0",
                  },
                  {
                    key: "collected",
                    header: t("clients.collected"),
                    width: "w-[18%]",
                    cellClassName: "text-right tabular-nums",
                    render: (r) => formatMoney(r.collected_total, currency, locale) || "0",
                  },
                  {
                    key: "outstanding",
                    header: t("clients.outstanding"),
                    width: "w-[18%]",
                    cellClassName: "text-right tabular-nums",
                    render: (r) => formatMoney(r.outstanding, currency, locale) || "0",
                  },
                ]}
                rows={rows}
                rowKey={(r) => r.id}
                onRowClick={(r) => router.push(`/clients/${r.id}`)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
              {rows.map((r) => (
                <div
                  key={r.id}
                  onClick={() => router.push(`/clients/${r.id}`)}
                  className="flex cursor-pointer flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate font-semibold text-foreground">{r.name}</h3>
                    <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(r.status)}`}>
                      {tClients(`statuses.${r.status}`)}
                    </span>
                  </div>
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">{t("clients.projectsCount")}</dt>
                      <dd className="tabular-nums">{r.projects_count}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">{t("clients.invoiced")}</dt>
                      <dd className="tabular-nums">{formatMoney(r.invoiced_total, currency, locale) || "0"}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">{t("clients.collected")}</dt>
                      <dd className="tabular-nums">{formatMoney(r.collected_total, currency, locale) || "0"}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">{t("clients.outstanding")}</dt>
                      <dd className="tabular-nums">{formatMoney(r.outstanding, currency, locale) || "0"}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
            {total > perPage && (
              <div className="mt-6">
                <Pagination
                  page={page}
                  perPage={perPage}
                  total={total}
                  lastPage={lastPage}
                  onPageChange={setPage}
                  onPerPageChange={() => {}}
                  disabled={loading}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
