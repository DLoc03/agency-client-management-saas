/**
 * Portal Dashboard Page — /[locale]/portal (FE-003, real data FE-013)
 * Protected portal route with route guard.
 * Lists the signed-in client's own projects from the real Portal API.
 */

"use client";

import { Link, useRouter } from "@/i18n/routing";
import { usePortalAuth, type PortalProject } from "@/lib/portal-auth";
import { statusBadgeClass } from "@/lib/status-colors";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

export default function PortalDashboardPage() {
  const { session, logout, isLoading } = usePortalAuth();
  const router = useRouter();
  const t = useTranslations("Portal.dashboard");
  const tp = useTranslations("Portal.projects");
  const ts = useTranslations("Projects.statuses");

  const [projects, setProjects] = useState<PortalProject[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  // Client-side guard for portal
  useEffect(() => {
    if (!isLoading && !session) {
      router.replace("/portal/login");
    }
  }, [isLoading, session, router]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/portal/projects", {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error("load failed");
        const body = await res.json();
        if (!cancelled) setProjects(Array.isArray(body.data) ? body.data : []);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (isLoading || !session) {
    return null;
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        {/* Header */}
        <div className="flex flex-col gap-1 border-b border-slate-100 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {t("title")}
            </h1>
            <p className="mt-1 text-base text-slate-700">
              {t("welcome", { name: session.client.name })}
            </p>
            <p className="text-xs text-slate-500">
              {t("agency", { agency: session.agency.name })} •{" "}
              {t("clientId", { id: session.client.client_id ?? session.client.id })}
            </p>
          </div>

          <button
            onClick={async () => {
              await logout();
              router.replace("/portal/login");
            }}
            className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:mt-0"
          >
            {t("signOut")}
          </button>
        </div>

        {/* Projects */}
        <h2 className="mt-8 text-lg font-semibold text-slate-900">{tp("title")}</h2>

        {loadError ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {tp("loadError")}
          </p>
        ) : projects === null ? (
          <p className="mt-4 text-sm text-slate-500">…</p>
        ) : projects.length === 0 ? (
          <div className="my-10 flex flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <svg
                className="h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-700">{tp("empty")}</p>
            <p className="mt-1 max-w-md text-sm text-slate-500">{tp("emptyHint")}</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {projects.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/portal/projects/${project.id}`}
                  className="block rounded-xl border border-slate-200 p-4 transition hover:border-emerald-300 hover:shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-slate-900">{project.name}</span>
                    <span
                      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(project.status)}`}
                    >
                      {ts(project.status)}
                    </span>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{tp("progress")}</span>
                      <span>
                        {tp("tasksDone", {
                          done: project.tasks_done_count ?? 0,
                          total: project.tasks_count ?? 0,
                        })}{" "}
                        · {project.progress_percent ?? 0}%
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${project.progress_percent ?? 0}%` }}
                      />
                    </div>
                  </div>
                  {project.due_date && (
                    <p className="mt-2 text-xs text-slate-500">
                      {tp("due", { date: project.due_date })}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
