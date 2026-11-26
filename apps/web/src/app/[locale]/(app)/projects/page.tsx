"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { Icon } from "@/components/shell/Icon";
import { Select } from "@/components/ui/Select";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  listProjects,
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
  const c = useTranslations("Common");

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<{ id: number; name: string }[]>([]);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [clientId, setClientId] = useState("");
  const [managerId, setManagerId] = useState("");

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
      const data = await listProjects({
        q: q || undefined,
        status: status || undefined,
        client_id: clientId ? Number(clientId) : undefined,
        project_manager_id: managerId ? Number(managerId) : undefined,
      });
      setProjects(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, q, status, clientId, managerId]);

  const canCreate = !!session?.user.permissions.includes("projects.create");
  const canDelete = !!session?.user.permissions.includes("projects.delete");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
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
      setError(e instanceof Error ? e.message : t("errors.createFailed"));
    } finally {
      setCreating(false);
    }
  };

  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    try {
      await deleteProject(id);
      setPendingDeleteId(null);
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
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder={t("filters.search")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-[180px] flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <Select
          value={status}
          onValueChange={setStatus}
          options={[
            { value: "", label: `${t("filters.all")} ${t("filters.status")}` },
            ...PROJECT_STATUSES.map((s) => ({ value: s, label: t(`statuses.${s}`) })),
          ]}
          className="w-[190px] max-w-full"
        />
        <Select
          value={clientId}
          onValueChange={setClientId}
          options={[
            { value: "", label: `${t("filters.all")} ${t("filters.client")}` },
            ...clients.map((cl) => ({ value: String(cl.id), label: cl.name })),
          ]}
          className="w-[190px] max-w-full"
        />
        <Select
          value={managerId}
          onValueChange={setManagerId}
          options={[
            { value: "", label: `${t("filters.all")} ${t("filters.manager")}` },
            ...managers.map((m) => ({ value: String(m.id), label: m.name })),
          ]}
          className="w-[190px] max-w-full"
        />
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="min-h-[320px]">
        {loading ? (
          <p className="text-sm text-muted-foreground">{c("loading")}</p>
        ) : projects.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
            <Icon name="folder-kanban" className="mb-3 h-8 w-8 text-muted-foreground" />
            <h3 className="text-base font-semibold text-foreground">{t("empty.title")}</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {t("empty.description")}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => {
              const pct = p.progress_percent ?? 0;
              const done = p.tasks_done_count ?? 0;
              const total = p.tasks_count ?? 0;
              return (
                <div
                  key={p.id}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
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
                          {
                            label: t("actions.detail"),
                            icon: "eye",
                            onClick: () => router.push(`/projects/${p.id}`),
                          },
                          ...(canDelete
                            ? [
                                {
                                  label: t("actions.delete"),
                                  icon: "trash-2",
                                  danger: true,
                                  onClick: () => setPendingDeleteId(p.id),
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
      {pendingDeleteId !== null && (
        <ConfirmDialog
          open
          title={t("actions.delete") + "?"}
          confirmLabel={t("actions.delete")}
          danger
          onConfirm={() => handleDelete(pendingDeleteId)}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </div>
  );
}