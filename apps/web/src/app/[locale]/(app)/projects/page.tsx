"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { Icon } from "@/components/shell/Icon";
import { Select } from "@/components/ui/Select";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { DataTable, DataTableSkeleton } from "@/components/ui/DataTable";
import { SkeletonCardGrid, useDelayedSkeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { Forbidden, isForbiddenError } from "@/components/ui/Forbidden";
import {
  listProjectsPage,
  createProject,
  deleteProject,
  listClients,
} from "@/lib/projects/api";
import { statusBadgeClass } from "@/lib/status-colors";
import type { Project, ProjectStatus } from "@/lib/projects/types";

const PROJECT_STATUSES: ProjectStatus[] = [
  "draft",
  "in_progress",
  "on_hold",
  "completed",
  "cancelled",
];

export default function ProjectsPage() {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("Projects");
  const confirmAction = useConfirm();
  const c = useTranslations("Common");

  const [projects, setProjects] = useState<Project[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [clients, setClients] = useState<{ id: number; name: string }[]>([]);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [clientId, setClientId] = useState("");
  const [managerId, setManagerId] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({
    name: "",
    description: "",
    client_id: "",
    status: "draft",
    project_manager_id: "",
    start_date: "",
    due_date: "",
    budget: "",
  });

  useEffect(() => {
    if (!isLoading && !session) router.replace("/login");
  }, [isLoading, session, router]);

  useEffect(() => {
    listClients()
      .then(setClients)
      .catch(() => setClients([]));
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listProjectsPage({
        q: q || undefined,
        status: status || undefined,
        client_id: clientId ? Number(clientId) : undefined,
        project_manager_id: managerId ? Number(managerId) : undefined,
        page,
        per_page: perPage,
      });
      setProjects(res.data || []);
      setTotal(res.meta?.total ?? res.data?.length ?? 0);
      setLastPage(res.meta?.last_page ?? 1);
      setHasLoaded(true);
      setForbidden(false);
    } catch (e) {
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, q, status, clientId, managerId, page, perPage]);

  useEffect(() => {
    setPage(1);
  }, [q, status, clientId, managerId]);

  useEffect(() => {
    if (page > lastPage) setPage(lastPage);
  }, [page, lastPage]);

  const canCreate = !!session?.user.permissions.includes("projects.create");
  const showSkeleton = useDelayedSkeleton(loading && !hasLoaded);
  const refetching = loading && hasLoaded;

  const canDelete = !!session?.user.permissions.includes("projects.delete");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setFormError(null);
    try {
      await createProject({
        name: form.name,
        description: form.description || null,
        client_id: Number(form.client_id),
        status: form.status,
        project_manager_id: form.project_manager_id
          ? Number(form.project_manager_id)
          : null,
        start_date: form.start_date || null,
        due_date: form.due_date || null,
        budget: form.budget ? Number(form.budget) : null,
      });
      setShowCreate(false);
      setForm({
        name: "",
        description: "",
        client_id: "",
        status: "draft",
        project_manager_id: "",
        start_date: "",
        due_date: "",
        budget: "",
      });
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t("errors.createFailed"));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!(await confirmAction(t("confirmDelete"), { intent: "delete" }))) return;
    try {
      await deleteProject(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.deleteFailed"));
    }
  };

  // distinct managers/clients from loaded projects for filter dropdowns
  const managers = Array.from(
    new Map(
      projects
        .filter((p) => p.project_manager)
        .map((p) => [p.project_manager!.id, p.project_manager!])
    ).values()
  );

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
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Forbidden />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Icon name="folder-kanban" className="h-4 w-4" />
            {t("newProject")}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <input
          type="search"
          placeholder={t("filters.search")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm sm:min-w-[180px] sm:flex-1"
        />
        <Select
          value={status}
          onValueChange={setStatus}
          options={[
            { value: "", label: `${t("filters.all")} ${t("filters.status")}` },
            ...PROJECT_STATUSES.map((s) => ({ value: s, label: t(`statuses.${s}`) })),
          ]}
          className="w-full max-w-full sm:w-[190px]"
        />
        <Select
          value={clientId}
          onValueChange={setClientId}
          options={[
            { value: "", label: `${t("filters.all")} ${t("filters.client")}` },
            ...clients.map((cl) => ({ value: String(cl.id), label: cl.name })),
          ]}
          className="w-full max-w-full sm:w-[190px]"
        />
        <Select
          value={managerId}
          onValueChange={setManagerId}
          options={[
            { value: "", label: `${t("filters.all")} ${t("filters.manager")}` },
            ...managers.map((m) => ({ value: String(m.id), label: m.name })),
          ]}
          className="w-full max-w-full sm:w-[190px]"
        />
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="min-h-[320px]">
        {loading && !hasLoaded ? (
          showSkeleton ? (
            <>
              <div className="hidden lg:block">
                <DataTableSkeleton columns={["w-[26%]", "w-[20%]", "w-[13%]", "w-[22%]", "w-[10%]", "w-[9%]"]} />
              </div>
              <div className="lg:hidden">
                <SkeletonCardGrid variant="lg3" />
              </div>
            </>
          ) : (
            <div className="min-h-[240px]" />
          )
        ) : projects.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
            <Icon name="folder-kanban" className="mb-3 h-8 w-8 text-muted-foreground" />
            <h3 className="text-base font-semibold text-foreground">{t("empty.title")}</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {t("empty.description")}
            </p>
          </div>
        ) : (
          <>
          <div aria-busy={refetching} className={refetching ? "pointer-events-none opacity-60 transition-opacity" : undefined}>
            <div className="hidden lg:block">
              <DataTable
                columns={[
                  {
                    key: "name",
                    header: t("fields.name"),
                    width: "w-[26%]",
                    render: (p) => <span className="block truncate font-medium text-foreground">{p.name}</span>,
                  },
                  {
                    key: "client",
                    header: t("fields.client"),
                    width: "w-[20%]",
                    render: (p) => <span className="block truncate">{p.client?.name ?? "—"}</span>,
                  },
                  {
                    key: "status",
                    header: t("fields.status"),
                    width: "w-[13%]",
                    render: (p) => (
                      <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(p.status)}`}>
                        {t(`statuses.${p.status}`)}
                      </span>
                    ),
                  },
                  {
                    key: "progress",
                    header: t("fields.progress"),
                    width: "w-[22%]",
                    render: (p) => {
                      const pct = p.progress_percent ?? 0;
                      return (
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-24 overflow-hidden rounded-full bg-secondary">
                            <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
                          </span>
                          <span className="text-xs font-medium tabular-nums">{pct}%</span>
                        </span>
                      );
                    },
                  },
                  {
                    key: "tasks",
                    header: t("fields.tasks"),
                    width: "w-[10%]",
                    cellClassName: "tabular-nums",
                    render: (p) => `${p.tasks_done_count ?? 0}/${p.tasks_count ?? 0}`,
                  },
                  {
                    key: "actions",
                    header: "",
                    width: "w-[9%]",
                    render: (p) => (
                      <ActionMenu
                        items={[
                          ...(canDelete
                            ? [
                                {
                                  label: t("actions.delete"),
                                  icon: "trash-2",
                                  danger: true,
                                  onClick: () => handleDelete(p.id),
                                },
                              ]
                            : []),
                        ]}
                      />
                    ),
                  },
                ]}
                rows={projects}
                rowKey={(p) => p.id}
                onRowClick={(p) => router.push(`/projects/${p.id}`)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:hidden">
            {projects.map((p) => {
              const pct = p.progress_percent ?? 0;
              const done = p.tasks_done_count ?? 0;
              const total = p.tasks_count ?? 0;
              return (
                <div
                  key={p.id}
                  onClick={() => router.push(`/projects/${p.id}`)}
                  className="flex min-w-0 cursor-pointer flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{p.name}</h3>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.client?.name ?? "—"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-start gap-1">
                      <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(p.status)}`}>
                        {t(`statuses.${p.status}`)}
                      </span>
                      <ActionMenu
                        items={[
                          ...(canDelete
                            ? [
                                {
                                  label: t("actions.delete"),
                                  icon: "trash-2",
                                  danger: true,
                                  onClick: () => handleDelete(p.id),
                                },
                              ]
                            : []),
                        ]}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{t("fields.progress")}</span>
                      <span className="font-medium tabular-nums">
                        {pct}% · {done}/{total}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          </div>
          <div className="mt-6">
            <Pagination
              page={page}
              perPage={perPage}
              total={total}
              lastPage={lastPage}
              onPageChange={setPage}
              onPerPageChange={(value) => {
                setPerPage(value);
                setPage(1);
              }}
              disabled={loading}
            />
          </div>
          </>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-lg space-y-4 rounded-lg bg-background p-6 shadow-xl"
          >
            <h2 className="text-lg font-semibold">{t("newProject")}</h2>
            {formError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {formError}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("fields.name")} <span className="text-red-500" aria-hidden="true">*</span></label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("fields.description")}</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                rows={3}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("fields.client")} <span className="text-red-500" aria-hidden="true">*</span></label>
                {clients.length > 0 ? (
                  <Select
                    value={form.client_id}
                    onValueChange={(v) => setForm({ ...form, client_id: v })}
                    options={[
                      { value: "", label: "—" },
                      ...clients.map((cl) => ({ value: String(cl.id), label: cl.name })),
                    ]}
                    className="w-full"
                  />
                ) : (
                  <input
                    required
                    type="number"
                    value={form.client_id}
                    onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("fields.status")}</label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v })}
                  options={PROJECT_STATUSES.map((s) => ({ value: s, label: t(`statuses.${s}`) }))}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("fields.manager")}</label>
                <Select
                  value={form.project_manager_id}
                  onValueChange={(v) => setForm({ ...form, project_manager_id: v })}
                  options={[
                    { value: "", label: "—" },
                    ...managers.map((m) => ({ value: String(m.id), label: m.name })),
                  ]}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("fields.budget")}</label>
                <input
                  type="number"
                  value={form.budget}
                  onChange={(e) => setForm({ ...form, budget: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("fields.startDate")}</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("fields.dueDate")}</label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-md border border-border px-4 py-2 text-sm"
              >
                {t("actions.cancel")}
              </button>
              <button
                type="submit"
                disabled={creating}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {creating ? c("loading") : t("actions.create")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}