/**
 * Portal Project Detail — /[locale]/portal/projects/[projectId] (FE-013)
 * Read-only view of one of the client's own projects: progress,
 * milestones and tasks from the real Portal API (BE-006 endpoints).
 */

"use client";

import { Link, useRouter } from "@/i18n/routing";
import { usePortalAuth, type PortalProject } from "@/lib/portal-auth";
import { statusBadgeClass } from "@/lib/status-colors";
import { useTranslations } from "next-intl";
import { use, useEffect, useState } from "react";

export default function PortalProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { session, isLoading } = usePortalAuth();
  const router = useRouter();
  const tp = useTranslations("Portal.projects");
  const ts = useTranslations("Projects");

  const [project, setProject] = useState<PortalProject | null>(null);
  const [loadError, setLoadError] = useState(false);

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
        const res = await fetch(`/api/portal/projects/${projectId}`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error("load failed");
        const body = await res.json();
        if (!cancelled) setProject(body.data as PortalProject);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, projectId]);

  if (isLoading || !session) {
    return null;
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link
          href="/portal"
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
          </svg>
          {tp("back")}
        </Link>

        {loadError ? (
          <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {tp("loadError")}
          </p>
        ) : project === null ? (
          <p className="mt-6 text-sm text-slate-500">…</p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {project.name}
              </h1>
              <span
                className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(project.status)}`}
              >
                {ts(`statuses.${project.status}`)}
              </span>
            </div>

            {project.description && (
              <p className="mt-2 whitespace-pre-line text-sm text-slate-600">
                {project.description}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
              {project.start_date && (
                <span>
                  {tp("startDate")}: {project.start_date}
                </span>
              )}
              {project.due_date && (
                <span>
                  {tp("dueDate")}: {project.due_date}
                </span>
              )}
            </div>

            <div className="mt-6">
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

            <h2 className="mt-8 text-lg font-semibold text-slate-900">
              {tp("milestones")}
            </h2>
            {!project.milestones || project.milestones.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">{tp("noMilestones")}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {project.milestones.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">{m.name}</p>
                      {m.due_date && (
                        <p className="text-xs text-slate-500">
                          {tp("dueDate")}: {m.due_date}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">{m.progress_percent}%</span>
                      <span
                        className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(m.status)}`}
                      >
                        {ts(`milestoneStatuses.${m.status}`)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <h2 className="mt-8 text-lg font-semibold text-slate-900">{tp("tasks")}</h2>
            {!project.tasks || project.tasks.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">{tp("noTasks")}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {project.tasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">{task.title}</p>
                      {task.due_date && (
                        <p className="text-xs text-slate-500">
                          {tp("dueDate")}: {task.due_date.slice(0, 10)}
                        </p>
                      )}
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(task.status)}`}
                    >
                      {ts(`taskStatuses.${task.status}`)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  );
}
