"use client";

import { usePortalAuth } from "@/lib/portal-auth";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import Link from "next/link";

interface DashboardData {
  projects: Array<{ id: number; name: string; status: string; progress_percent?: number; tasks_count?: number; tasks_done_count?: number }>;
  pending_approvals: { count: number; items: Array<{ id: number; project_id: number; project_name: string; title: string; created_at: string }> };
  unpaid_invoices: { count: number; total_due: number };
  recent_files: Array<{ id: number; original_name: string; project_id: number; created_at: string }>;
}

export default function PortalDashboardPage() {
  const { session, isLoading } = usePortalAuth();
  const router = useRouter();
  const t = useTranslations("Portal");
  const tp = useTranslations("Portal.projects");

  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isLoading && !session) router.replace("/portal/login");
  }, [isLoading, session, router]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/portal/dashboard", { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error("fail");
        const body = await res.json();
        if (!cancelled) setData(body.data as DashboardData);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [session]);

  if (isLoading || !session) return null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t("dashboard.title")}</h1>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{tp("loadError")}</p>
      )}

      {!data ? (
        <p className="text-sm text-slate-500">…</p>
      ) : (
        <>
          {data.pending_approvals.count > 0 && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="text-lg font-semibold text-slate-900">{t("pendingApprovals")}</h2>
              <p className="text-sm text-slate-600">{data.pending_approvals.count}</p>
              <ul className="mt-3 space-y-2">
                {data.pending_approvals.items.map((a) => (
                  <li key={a.id}>
                    <Link href={`/portal/projects/${a.project_id}`} className="text-sm font-medium text-emerald-700 hover:underline">
                      {a.project_name} — {a.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.unpaid_invoices.count > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-slate-900">{t("unpaidInvoices")}</h2>
              <p className="text-sm text-slate-600">
                {data.unpaid_invoices.count} · {data.unpaid_invoices.total_due}
              </p>
              <Link href="/portal/invoices" className="mt-2 inline-block text-sm font-medium text-emerald-700 hover:underline">
                {t("viewAll")}
              </Link>
            </section>
          )}

          {data.recent_files.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-slate-900">{t("recentFiles")}</h2>
              <ul className="mt-3 space-y-1">
                {data.recent_files.map((f) => (
                  <li key={f.id} className="text-sm text-slate-700">{f.original_name}</li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="text-lg font-semibold text-slate-900">{tp("title")}</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {data.projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/portal/projects/${p.id}`}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                >
                  <h3 className="text-base font-semibold text-slate-900">{p.name}</h3>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${p.progress_percent ?? 0}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{p.progress_percent ?? 0}%</p>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
