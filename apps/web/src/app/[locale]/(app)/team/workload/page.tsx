"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { getWorkload } from "@/lib/team/api";
import type { WorkloadRow } from "@/lib/team/types";

export default function WorkloadPage() {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations("Teams");
  const c = useTranslations("Common");

  const [rows, setRows] = useState<WorkloadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      } catch (e) {
        setError(e instanceof Error ? e.message : t("errors.loadFailed"));
      } finally {
        setLoading(false);
      }
    })();
  }, [session]);

  if (isLoading || !session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">{c("loading")}</p>
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
        {loading ? (
          <p className="text-sm text-muted-foreground">{c("loading")}</p>
        ) : rows.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
            <h3 className="text-base font-semibold text-foreground">{t("empty.title")}</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">{t("empty.description")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.user_id} className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm">
                    <span>{t("fields.openTasks")}: <strong>{r.open_tasks}</strong></span>
                    <span className="text-red-600">{t("fields.overdue")}: <strong>{r.overdue_tasks}</strong></span>
                    <span>{t("fields.dueNext7")}: <strong>{r.due_next_7_days}</strong></span>
                    <span>{t("fields.projects")}: <strong>{r.projects_count}</strong></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}