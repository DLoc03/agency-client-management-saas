"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useRouter } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { Icon } from "@/components/shell/Icon";
import { Skeleton, useDelayedSkeleton } from "@/components/ui/Skeleton";
import { getAnalyticsOverview } from "@/lib/analytics/api";
import type { AnalyticsOverview } from "@/lib/analytics/types";
import { statusBadgeClass } from "@/lib/status-colors";
import { formatMoney } from "@/lib/currency";

export default function DashboardPage() {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("Analytics");
  const tLeads = useTranslations("Leads");
  const tProjects = useTranslations("Projects");
  const c = useTranslations("Common");

  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showSkeleton = useDelayedSkeleton(loading && !hasLoaded);

  useEffect(() => {
    if (!isLoading && !session) router.replace("/login");
  }, [isLoading, session, router]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAnalyticsOverview()
      .then((data) => {
        if (cancelled) return;
        setOverview(data);
        setHasLoaded(true);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : t("errors.loadFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, t]);

  if (isLoading || !session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">{c("loading")}</p>
      </div>
    );
  }

  const currency = session.agency.base_currency || "USD";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">
            {t("welcome", { name: session.user.name })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("agency", { agency: session.agency.name })}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && !hasLoaded ? (
        showSkeleton ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="mt-3 h-8 w-16" />
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <Skeleton className="h-40 w-full" />
            </div>
          </div>
        ) : (
          <div className="min-h-[240px]" />
        )
      ) : (
        <div className="space-y-8">
          {overview?.sales && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold tracking-tight">{t("sections.sales")}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label={t("sales.newLeadsThisMonth")}
                  value={overview.sales.new_leads_this_month}
                  delta={overview.sales.new_leads_delta_percent}
                />
                <StatCard
                  label={t("sales.activeClients")}
                  value={overview.sales.active_clients}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs font-medium text-muted-foreground self-center">
                  {t("sales.leadsByStage")}:
                </span>
                {Object.entries(overview.sales.leads_by_stage).map(([stage, count]) => (
                  <span
                    key={stage}
                    className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(stage)}`}
                  >
                    {tLeads(`statuses.${stage}`)} {count}
                  </span>
                ))}
              </div>
            </section>
          )}

          {overview?.projects && (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold tracking-tight">
                  {overview.projects.scope === "mine"
                    ? t("sections.projectsMine")
                    : t("sections.projects")}
                </h2>
                <Link
                  href="/reports?tab=projects"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  {t("links.viewReport")}
                  <Icon name="arrow-right" className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs font-medium text-muted-foreground self-center">
                  {t("projects.byStatus")}:
                </span>
                {Object.entries(overview.projects.projects_by_status).map(([status, count]) => (
                  <span
                    key={status}
                    className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(status)}`}
                  >
                    {tProjects(`statuses.${status}`)} {count}
                  </span>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("projects.tasksOverdue")}
                  </span>
                  <div
                    className={`mt-2 text-3xl font-bold tabular-nums ${
                      overview.projects.overdue_tasks > 0 ? "text-red-600" : "text-foreground"
                    }`}
                  >
                    {overview.projects.overdue_tasks}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("projects.projectsOverdue")}
                  </span>
                  <div className="mt-2 text-3xl font-bold tabular-nums text-foreground">
                    {overview.projects.overdue_projects}
                  </div>
                </div>
              </div>
            </section>
          )}

          {overview?.finance && (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold tracking-tight">{t("sections.finance")}</h2>
                <Link
                  href="/reports?tab=revenue"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  {t("links.viewReport")}
                  <Icon name="arrow-right" className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard
                  label={t("finance.collectedThisMonth")}
                  value={formatMoney(overview.finance.collected_this_month, currency, locale) || "0"}
                  delta={overview.finance.collected_delta_percent}
                />
                <StatCard
                  label={t("finance.invoicedThisMonth")}
                  value={formatMoney(overview.finance.invoiced_this_month, currency, locale) || "0"}
                />
                <StatCard
                  label={t("finance.outstanding")}
                  value={formatMoney(overview.finance.outstanding_total, currency, locale) || "0"}
                />
              </div>

              <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("finance.monthlySeries")}
                </div>
                {(() => {
                  const series = overview.finance.monthly_series || [];
                  const max = Math.max(
                    1,
                    ...series.map((p) => Math.max(parseFloat(p.invoiced) || 0, parseFloat(p.collected) || 0)),
                  );
                  return (
                    <>
                      <div className="flex items-end gap-2 h-44">
                        {series.map((p) => {
                          const invH = ((parseFloat(p.invoiced) || 0) / max) * 100;
                          const colH = ((parseFloat(p.collected) || 0) / max) * 100;
                          return (
                            <div key={p.month} className="flex flex-1 flex-col items-center gap-1">
                              <div className="flex w-full items-end justify-center gap-1 h-36">
                                <div
                                  className="w-1/2 rounded-t bg-blue-400/70"
                                  style={{ height: `${invH}%` }}
                                  title={`${p.month}: ${formatMoney(p.invoiced, currency, locale)}`}
                                />
                                <div
                                  className="w-1/2 rounded-t bg-green-500/70"
                                  style={{ height: `${colH}%` }}
                                  title={`${p.month}: ${formatMoney(p.collected, currency, locale)}`}
                                />
                              </div>
                              <span className="text-[10px] text-muted-foreground">{p.month.slice(5)}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-block h-3 w-3 rounded-sm bg-blue-400/70" />
                          {t("finance.legendInvoiced")}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-block h-3 w-3 rounded-sm bg-green-500/70" />
                          {t("finance.legendCollected")}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </section>
          )}

          {overview?.personal && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold tracking-tight">{t("sections.personal")}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <StatCard label={t("personal.myOpenTasks")} value={overview.personal.my_open_tasks} />
                <StatCard label={t("personal.myOverdueTasks")} value={overview.personal.my_overdue_tasks} />
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string | number;
  delta?: number | null;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {delta !== null && delta !== undefined && (
          <span
            className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
              delta > 0
                ? "bg-green-100 text-green-800"
                : delta < 0
                ? "bg-red-100 text-red-800"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            {delta > 0 ? "+" : ""}
            {delta}%
          </span>
        )}
      </div>
      <div className="mt-2 text-3xl font-bold tabular-nums text-foreground">{value}</div>
    </div>
  );
}
