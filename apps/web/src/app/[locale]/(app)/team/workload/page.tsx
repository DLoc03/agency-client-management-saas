"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { DataTable, DataTableSkeleton } from "@/components/ui/DataTable";
import { Skeleton, useDelayedSkeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/lib/auth";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Forbidden, isForbiddenError } from "@/components/ui/Forbidden";
import { getWorkload } from "@/lib/team/api";
import type { WorkloadRow } from "@/lib/team/types";

export default function WorkloadPage() {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations("Teams");
  const c = useTranslations("Common");

  const [rows, setRows] = useState<WorkloadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (!isLoading && !session) router.replace("/login");
  }, [isLoading, session, router]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        setRows(await getWorkload());
        setHasLoaded(true);
        setForbidden(false);
      } catch (e) {
        if (isForbiddenError(e)) setForbidden(true);
        else setError(e instanceof Error ? e.message : t("errors.loadFailed"));
      } finally {
        setLoading(false);
      }
    })();
  }, [session]);

  const showSkeleton = useDelayedSkeleton(loading && !hasLoaded);

  if (isLoading || !session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">{c("loading")}</p>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("workload.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("workload.subtitle")}</p>
        </div>
        <Forbidden />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("workload.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("workload.subtitle")}</p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="min-h-[320px]">
        {loading && !hasLoaded ? (
          showSkeleton ? (
            <>
              <div className="hidden lg:block">
                <DataTableSkeleton columns={["w-[40%]", "w-[15%]", "w-[15%]", "w-[15%]", "w-[15%]"]} />
              </div>
              <div className="space-y-3 lg:hidden">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} aria-hidden className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
                    <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-10 w-16" />
                    <Skeleton className="h-10 w-16" />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="min-h-[240px]" />
          )
        ) : rows.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
            <h3 className="text-base font-semibold text-foreground">{t("empty.title")}</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">{t("empty.description")}</p>
          </div>
        ) : (
          <>
            <div className="hidden lg:block">
              <DataTable
                columns={[
                  {
                    key: "member",
                    header: t("fields.name"),
                    width: "w-[40%]",
                    render: (r) => (
                      <span className="flex min-w-0 items-center gap-3">
                        <Avatar name={r.name} seed={r.user_id ?? r.name} className="h-9 w-9 shrink-0 text-xs" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-foreground">{r.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{r.email}</span>
                        </span>
                      </span>
                    ),
                  },
                  {
                    key: "open",
                    header: t("fields.openTasks"),
                    width: "w-[15%]",
                    cellClassName: "text-base font-semibold tabular-nums",
                    render: (r) => r.open_tasks,
                  },
                  {
                    key: "overdue",
                    header: t("fields.overdue"),
                    width: "w-[15%]",
                    cellClassName: "text-base font-semibold tabular-nums",
                    render: (r) => (
                      <span className={r.overdue_tasks > 0 ? "text-red-700" : undefined}>{r.overdue_tasks}</span>
                    ),
                  },
                  {
                    key: "dueNext7",
                    header: t("fields.dueNext7"),
                    width: "w-[15%]",
                    cellClassName: "text-base font-semibold tabular-nums",
                    render: (r) => r.due_next_7_days,
                  },
                  {
                    key: "projects",
                    header: t("fields.projects"),
                    width: "w-[15%]",
                    cellClassName: "text-base font-semibold tabular-nums",
                    render: (r) => r.projects_count,
                  },
                ]}
                rows={rows}
                rowKey={(r) => r.user_id}
                onRowClick={(r) => router.push(`/team/members/${r.user_id}`)}
              />
            </div>
            <div className="space-y-3 lg:hidden">
            {rows.map((r) => (
              <div
                key={r.user_id}
                onClick={() => router.push(`/team/members/${r.user_id}`)}
                className="cursor-pointer rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={r.name} seed={r.user_id ?? r.name} className="h-10 w-10 text-sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="rounded-md bg-accent px-2.5 py-1.5 text-center">
                      <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">{t("fields.openTasks")}</span>
                      <strong className="text-base">{r.open_tasks}</strong>
                    </span>
                    <span className={`rounded-md px-2.5 py-1.5 text-center ${r.overdue_tasks > 0 ? "bg-red-100 text-red-800" : "bg-accent"}`}>
                      <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">{t("fields.overdue")}</span>
                      <strong className="text-base">{r.overdue_tasks}</strong>
                    </span>
                    <span className="rounded-md bg-accent px-2.5 py-1.5 text-center">
                      <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">{t("fields.dueNext7")}</span>
                      <strong className="text-base">{r.due_next_7_days}</strong>
                    </span>
                    <span className="rounded-md bg-accent px-2.5 py-1.5 text-center">
                      <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">{t("fields.projects")}</span>
                      <strong className="text-base">{r.projects_count}</strong>
                    </span>
                  </div>
                </div>
              </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}