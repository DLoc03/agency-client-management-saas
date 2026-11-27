"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useRouter as useI18nRouter } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { Icon } from "@/components/shell/Icon";
import { Select } from "@/components/ui/Select";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { DataTable, DataTableSkeleton } from "@/components/ui/DataTable";
import { Skeleton, useDelayedSkeleton } from "@/components/ui/Skeleton";
import { priorityBadgeClass, statusBadgeClass } from "@/lib/status-colors";
import { formatMoney } from "@/lib/currency";
import { Avatar } from "@/components/ui/Avatar";
import { Forbidden, isForbiddenError } from "@/components/ui/Forbidden";
import {
  getProject,
  updateProject,
  deleteProject,
  listMembers,
  addMember,
  removeMember,
  listMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  getTimeline,
} from "@/lib/projects/api";
import { assignTeamToProject, listTeams, listUsers, removeTeamFromProject } from "@/lib/team/api";
import type { Team } from "@/lib/team/types";
import type {
  Project,
  ProjectStatus,
  Milestone,
  MilestoneStatus,
  Task,
  TaskStatus,
  TaskPriority,
  TimelineItem,
} from "@/lib/projects/types";

const PROJECT_STATUSES: ProjectStatus[] = ["draft", "in_progress", "on_hold", "completed", "cancelled"];
const TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "in_review", "done"];
const TASK_PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];
const MILESTONE_STATUSES: MilestoneStatus[] = ["planned", "in_progress", "completed"];

function fileIcon(name: string, mime: string): string {
  const n = name.toLowerCase();
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(n)) return "image";
  if (mime === "application/pdf" || /\.pdf$/i.test(n)) return "file-text";
  if (/\.(xlsx?|csv|ods)$/i.test(n) || mime.includes("spreadsheet") || mime.includes("csv")) return "file-spreadsheet";
  if (/\.(zip|rar|7z|tar|gz)$/i.test(n) || mime.includes("zip") || mime.includes("archive")) return "archive";
  return "file";
}

function DropzoneInternal({ onFile, label }: { onFile: (f: File) => void; label: string }) {
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) { setSelected(f); onFile(f); } }}
      onClick={() => inputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${dragging ? "border-primary bg-primary/5" : "border-border bg-muted/30 hover:border-primary/50 hover:bg-primary/5"}`}
    >
      <Icon name="upload" className="h-6 w-6 text-muted-foreground" />
      <p className="mt-2 text-sm text-muted-foreground">{selected ? selected.name : label}</p>
      <input ref={inputRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setSelected(f); onFile(f); } e.target.value = ""; }} />
    </div>
  );
}

function approvalStatusClass(status: string): string {
  switch (status) {
    case "approved": return "border-emerald-200 bg-emerald-100 text-emerald-800";
    case "changes_requested": return "border-rose-200 bg-rose-100 text-rose-800";
    default: return "border-amber-200 bg-amber-100 text-amber-800";
  }
}

export default function ProjectDetailPage() {
  const params = useParams();
  const id = Number(params?.id);
  const { session, isLoading } = useAuth();
  const router = useI18nRouter();
  const locale = useLocale();
  const t = useTranslations("Projects");
  const confirmAction = useConfirm();
  const c = useTranslations("Common");

  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<{ id: number; name: string; email: string; via_team_id: number | null }[]>([]);
  const [directory, setDirectory] = useState<{ id: number; name: string; email: string }[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [milestoneError, setMilestoneError] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  // Client Portal (FE-023)
  const [portalFiles, setPortalFiles] = useState<any[]>([]);
  const [portalComments, setPortalComments] = useState<any[]>([]);
  const [portalApprovals, setPortalApprovals] = useState<any[]>([]);
  const [portalHistory, setPortalHistory] = useState<any[]>([]);
  const [portalTab, setPortalTab] = useState<"files" | "discussion" | "approvals" | "history">("files");
  const [portalCommentDraft, setPortalCommentDraft] = useState("");
  const [portalApprovalTitle, setPortalApprovalTitle] = useState("");
  const [portalApprovalDesc, setPortalApprovalDesc] = useState("");
  const [portalError, setPortalError] = useState<string | null>(null);

  // task filters
  const [taskStatus, setTaskStatus] = useState("");
  const [taskPriority, setTaskPriority] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskMilestone, setTaskMilestone] = useState("");

  // modals
  const [showMember, setShowMember] = useState(false);
  const [memberUserId, setMemberUserId] = useState("");
  const [showMilestone, setShowMilestone] = useState(false);
  const [milestoneForm, setMilestoneForm] = useState({ name: "", description: "", due_date: "", status: "planned" });
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [showTask, setShowTask] = useState(false);
  const [teamAssignId, setTeamAssignId] = useState("");
  const [teamResult, setTeamResult] = useState<string | null>(null);
  const [assignTeams, setAssignTeams] = useState<Team[]>([]);

  // The team list also resolves the names behind each member's via_team_id
  // (FIX-021 labels), so load it for every viewer, not only project managers;
  // a failed load just leaves the labels unresolved.
  useEffect(() => {
    if (session) {
      listTeams()
        .then(setAssignTeams)
        .catch(() => setAssignTeams([]));
    }
  }, [session]);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    status: "todo",
    priority: "medium",
    assignee_id: "",
    due_date: "",
    milestone_id: "",
  });

  useEffect(() => {
    if (!isLoading && !session) router.replace("/login");
  }, [isLoading, session, router]);

  // First-load skeleton follows the DEC-021 timing (appears only after ~200 ms).
  const showSkeleton = useDelayedSkeleton(loading && !project);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, m, ms, tl] = await Promise.all([
        getProject(id),
        listMembers(id),
        listMilestones(id),
        getTimeline(id),
      ]);
      setProject(p);
      setMembers(m);
      setMilestones(ms);
      setTimeline(tl);
      setForbidden(false);
    } catch (e) {
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async () => {
    try {
      const data = await listTasks(id, {
        status: taskStatus || undefined,
        priority: taskPriority || undefined,
        assignee_id: taskAssignee ? Number(taskAssignee) : undefined,
        milestone_id: taskMilestone ? Number(taskMilestone) : undefined,
      });
      setTasks(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.loadFailed"));
    }
  };

  useEffect(() => {
    if (session && id) loadAll();
  }, [session, id]);

  useEffect(() => {
    if (!session || !id) return;
    let cancelled = false;
    const loadPortal = async () => {
      const fetchJson = async (url: string) => {
        try {
          const res = await fetch(url, { headers: { Accept: "application/json" } });
          if (!res.ok) return [];
          const b = await res.json();
          return b.data || [];
        } catch {
          return [];
        }
      };
      const [files, comments, approvals, history] = await Promise.all([
        fetchJson(`/api/projects/${id}/files?per_page=100`),
        fetchJson(`/api/projects/${id}/portal-comments?per_page=100`),
        fetchJson(`/api/projects/${id}/approvals?per_page=100`),
        fetchJson(`/api/projects/${id}/history?per_page=100`),
      ]);
      if (cancelled) return;
      setPortalFiles(files);
      setPortalComments(comments);
      setPortalApprovals(approvals);
      setPortalHistory(history);
    };
    loadPortal();
    return () => { cancelled = true; };
  }, [session, id]);

  useEffect(() => {
    if (session && id) loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, id, taskStatus, taskPriority, taskAssignee, taskMilestone]);

  const canManageMembers = !!session?.user.permissions.includes("projects.members.manage");
  const canManageMilestones = !!session?.user.permissions.includes("milestones.manage");
  const canCreateTask = !!session?.user.permissions.includes("tasks.create");
  const canUpdateTask = !!session?.user.permissions.includes("tasks.update");
  const canDeleteTask = !!session?.user.permissions.includes("tasks.delete");
  const canUpdateProject = !!session?.user.permissions.includes("projects.update");
  const canDeleteProject = !!session?.user.permissions.includes("projects.delete");
  const canManagePortalFiles = !!session?.user.permissions.includes("portal.files.manage");
  const canManagePortalApprovals = !!session?.user.permissions.includes("portal.approvals.manage");
  const currency = session?.agency.base_currency || "USD";
  // FIX-021 (option A): surface which teams currently contribute members.
  const teamNameFor = (teamId: number) =>
    assignTeams.find((tm) => tm.id === teamId)?.name ?? t("teamAssignment.deletedTeam");
  const assignedTeams = Array.from(
    members.reduce((acc, m) => {
      if (m.via_team_id != null) acc.set(m.via_team_id, (acc.get(m.via_team_id) ?? 0) + 1);
      return acc;
    }, new Map<number, number>()),
  ).map(([teamId, count]) => ({ id: teamId, name: teamNameFor(teamId), count }));

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addMember(id, Number(memberUserId));
      setMemberUserId("");
      setShowMember(false);
      const m = await listMembers(id);
      setMembers(m);
    } catch (e) {
      setMemberError(e instanceof Error ? e.message : t("errors.updateFailed"));
    }
  };

  const handleRemoveMember = async (userId: number) => {
    try {
      await removeMember(id, userId);
      setMembers((prev) => prev.filter((m) => m.id !== userId));
    } catch (e) {
      setMemberError(e instanceof Error ? e.message : t("errors.updateFailed"));
    }
  };

  const handleSaveMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: milestoneForm.name,
        description: milestoneForm.description || null,
        due_date: milestoneForm.due_date || null,
        status: milestoneForm.status,
      };
      if (editingMilestone) {
        await updateMilestone(id, editingMilestone.id, payload);
      } else {
        await createMilestone(id, payload);
      }
      setShowMilestone(false);
      setEditingMilestone(null);
      setMilestoneForm({ name: "", description: "", due_date: "", status: "planned" });
      const ms = await listMilestones(id);
      setMilestones(ms);
      const tl = await getTimeline(id);
      setTimeline(tl);
      const p = await getProject(id);
      setProject(p);
    } catch (e) {
      setMilestoneError(e instanceof Error ? e.message : t("errors.updateFailed"));
    }
  };

  const handleDeleteMilestone = async (milestoneId: number) => {
    if (!(await confirmAction(t("confirmDeleteMilestone"), { intent: "delete" }))) return;
    try {
      await deleteMilestone(id, milestoneId);
      setMilestones((prev) => prev.filter((m) => m.id !== milestoneId));
      const tl = await getTimeline(id);
      setTimeline(tl);
    } catch (e) {
      setMilestoneError(e instanceof Error ? e.message : t("errors.deleteFailed"));
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createTask(id, {
        title: taskForm.title,
        description: taskForm.description || null,
        status: taskForm.status,
        priority: taskForm.priority,
        assignee_id: taskForm.assignee_id ? Number(taskForm.assignee_id) : null,
        due_date: taskForm.due_date || null,
        milestone_id: taskForm.milestone_id ? Number(taskForm.milestone_id) : null,
      });
      setShowTask(false);
      setTaskForm({
        title: "",
        description: "",
        status: "todo",
        priority: "medium",
        assignee_id: "",
        due_date: "",
        milestone_id: "",
      });
      await loadTasks();
      const p = await getProject(id);
      setProject(p);
    } catch (e) {
      setTaskError(e instanceof Error ? e.message : t("errors.createFailed"));
    }
  };

  const handleToggleTaskVisibility = async (task: Task) => {
    const next = !(task.client_visible !== false);
    try {
      const updated = await updateTask(task.id, { client_visible: next });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, client_visible: updated.client_visible } : t)));
    } catch (e) {
      setTaskError(e instanceof Error ? e.message : t("errors.updateFailed"));
    }
  };

  const handleToggleMilestoneVisibility = async (m: Milestone) => {
    const next = !(m.client_visible !== false);
    try {
      const updated = await updateMilestone(id, m.id, { client_visible: next });
      setMilestones((prev) => prev.map((x) => (x.id === m.id ? { ...x, client_visible: updated.client_visible } : x)));
    } catch (e) {
      setMilestoneError(e instanceof Error ? e.message : t("errors.updateFailed"));
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!(await confirmAction(t("confirmDeleteTask"), { intent: "delete" }))) return;
    try {
      await deleteTask(taskId);
      await loadTasks();
      const p = await getProject(id);
      setProject(p);
    } catch (e) {
      setTaskError(e instanceof Error ? e.message : t("errors.deleteFailed"));
    }
  };

  const handleAssignTeam = async () => {
    if (!teamAssignId) return;
    setTeamResult(null);
    try {
      const res = await assignTeamToProject(id, Number(teamAssignId));
      const added = res.added_user_ids?.length ?? 0;
      setTeamResult(t("teamAssignment.resultAssigned", { added }));
      const p = await getProject(id);
      setProject(p);
      const m = await listMembers(id);
      setMembers(m);
    } catch (e) {
      setTeamError(e instanceof Error ? e.message : t("errors.updateFailed"));
    }
  };

  const handleRemoveTeam = async () => {
    if (!teamAssignId) return;
    setTeamResult(null);
    try {
      const res = await removeTeamFromProject(id, Number(teamAssignId));
      const removed = res.removed_user_ids?.length ?? 0;
      const kept = res.kept_user_ids?.length ?? 0;
      setTeamResult(t("teamAssignment.resultRemoved", { removed, kept }));
      const m = await listMembers(id);
      setMembers(m);
    } catch (e) {
      setTeamError(e instanceof Error ? e.message : t("errors.updateFailed"));
    }
  };

  if (isLoading || !session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">{c("loading")}</p>
      </div>
    );
  }

  if (!project) {
    if (forbidden) {
      return <Forbidden />;
    }
    if (!loading) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-sm text-muted-foreground">{error ?? c("loading")}</p>
        </div>
      );
    }
    if (!showSkeleton) {
      // Fast load: hold the layout height without flashing a skeleton (DEC-021).
      return <div className="min-h-[60vh]" />;
    }
    // First load: geometric skeleton of the detail layout (DEC-021). The
    // Tasks section gets a true table twin (DEC-022), not generic bars.
    return (
      <div aria-hidden className="space-y-6">
        <Skeleton className="h-5 w-24" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <section className="space-y-3 rounded-lg border border-border bg-card p-6 shadow-sm">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </section>
        <section className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
          <Skeleton className="h-5 w-32" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        </section>
        <section className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
          <Skeleton className="h-5 w-24" />
          <div className="hidden lg:block">
            <DataTableSkeleton
              framed={false}
              rows={4}
              columns={["w-[34%]", "w-[14%]", "w-[12%]", "w-[18%]", "w-[12%]", "w-[10%]"]}
            />
          </div>
          <div className="space-y-3 lg:hidden">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </section>
      </div>
    );
  }

  const pct = project.progress_percent ?? 0;
  const done = project.tasks_done_count ?? 0;
  const total = project.tasks_count ?? 0;
  const openTasks = total - done;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push("/projects")}
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Icon name="chevron-left" className="h-4 w-4" />
            {t("actions.back")}
          </button>
        {canDeleteProject && (
          <button
            type="button"
            onClick={async () => {
              if (!(await confirmAction(t("confirmDelete"), { intent: "delete" }))) return;
              try {
                await deleteProject(id);
                router.push("/projects");
              } catch (e) {
                setError(e instanceof Error ? e.message : t("errors.deleteFailed"));
              }
            }}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
          ><Icon name="trash-2" className="h-4 w-4" /> 
            {t("actions.delete")}
          </button>
        )}
        </div>
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-bold tracking-tight">{project.name}</h1>
          <p className="text-sm text-muted-foreground">
            {project.client?.name ?? "—"} · {t(`statuses.${project.status}`)}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {openTasks > 0 && project.status === "completed" && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("detail.progressWarning")}
        </div>
      )}

      {/* Overview */}
      <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">{t("detail.overview")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">{t("fields.client")}</p>
            <p className="break-words font-medium">{project.client?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("fields.manager")}</p>
            <p className="break-words font-medium">{project.project_manager?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("fields.startDate")}</p>
            <p className="break-words font-medium">{project.start_date ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("fields.dueDate")}</p>
            <p className="break-words font-medium">{project.due_date ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("fields.budget")}</p>
            <p className="break-words font-medium">{project.budget ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("fields.status")}</p>
            {canUpdateProject ? (
              <Select
                value={project.status}
                onValueChange={async (v) => {
                  try {
                    const updated = await updateProject(id, { status: v });
                    setProject(updated);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : t("errors.updateFailed"));
                  }
                }}
                options={PROJECT_STATUSES.map((s) => ({ value: s, label: t(`statuses.${s}`) }))}
                className="mt-1 w-[170px]"
              />
            ) : (
              <p className="font-medium">{t(`statuses.${project.status}`)}</p>
            )}
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground">{t("fields.progress")}</p>
            <div className="mt-1 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                />
              </div>
              <span className="text-sm font-medium tabular-nums">
                {pct}% · {done}/{total}
              </span>
            </div>
          </div>
        </div>
        {project.description && (
          <p className="mt-4 text-sm text-muted-foreground">{project.description}</p>
        )}
      </section>

      {/* Budget reconciliation (read-only, BE-008 / FINANCE_CONTRACT §6). */}
      <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("detail.budgetReconciliation")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("budget.reconciliationHint")}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">{t("fields.budget")}</p>
            <p className="font-medium tabular-nums">
              {project.budget != null ? formatMoney(project.budget, currency, locale) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("budget.invoiced")}</p>
            <p className="font-medium tabular-nums text-blue-700">
              {formatMoney(project.invoiced_total, currency, locale) || "0"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("budget.collected")}</p>
            <p className="font-medium tabular-nums text-green-700">
              {formatMoney(project.collected_total, currency, locale) || "0"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("budget.remaining")}</p>
            <p className="font-medium tabular-nums text-foreground">
              {formatMoney(project.remaining_budget ?? (project.budget != null ? Number(project.budget) - Number(project.invoiced_total || 0) : null), currency, locale) || "—"}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {t("budget.note")}
        </p>
      </section>

      {/* Members */}
      <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("detail.members")}</h2>
          {memberError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {memberError}
            </div>
          )}
          {canManageMembers && (
            <button
              type="button"
              onClick={async () => {
                setShowMember(true);
                if (directory.length === 0) {
                  try {
                    const users = await listUsers();
                    setDirectory(users.map((u) => ({ id: u.id, name: u.name, email: u.email })));
                  } catch {
                    /* directory unavailable — the picker stays empty */
                  }
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
            >
              <Icon name="user-plus" className="h-3.5 w-3.5" />
              {t("actions.addMember")}
            </button>
          )}
        </div>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("detail.noMembers")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-secondary py-1 pl-1 pr-3 text-xs font-medium text-secondary-foreground"
              >
                <Avatar name={m.name} seed={m.id} className="h-5 w-5 text-[10px]" />
                <span className="whitespace-nowrap">{m.name}</span>
                {m.via_team_id != null && (
                  <span className="whitespace-nowrap rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary-text">
                    {teamNameFor(m.via_team_id)}
                  </span>
                )}
                {canManageMembers && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(m.id)}
                    className="rounded-full p-1 text-red-600 transition-colors hover:bg-red-100 hover:text-red-800"
                    aria-label={t("actions.remove")}
                  >
                    <Icon name="x" className="h-3.5 w-3.5" />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Team assignment (FE-009) */}
      {session.user.permissions.includes("projects.update") && (
        <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">{t("teamAssignment.title")}</h2>
          {teamError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {teamError}
            </div>
          )}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{t("teamAssignment.assignedTeams")}:</span>
            {assignedTeams.length === 0 ? (
              <span className="text-sm text-muted-foreground">{t("teamAssignment.noTeamsAssigned")}</span>
            ) : (
              assignedTeams.map((tm) => (
                <span
                  key={tm.id}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground"
                >
                  {tm.name}
                  <span className="text-muted-foreground">· {t("teamAssignment.teamMembersCount", { count: tm.count })}</span>
                </span>
              ))
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Select
              value={teamAssignId}
              onValueChange={setTeamAssignId}
              options={[
                { value: "", label: t("teamAssignment.selectTeam") },
                ...assignTeams.map((tm) => ({ value: String(tm.id), label: tm.name })),
              ]}
              className="w-56"
            />
            <button
              type="button"
              onClick={handleAssignTeam}
              disabled={!teamAssignId}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            ><Icon name="user-plus" className="h-4 w-4" /> 
              {t("teamAssignment.assign")}
            </button>
            <button
              type="button"
              onClick={handleRemoveTeam}
              disabled={!teamAssignId}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm text-red-600 disabled:opacity-60"
            ><Icon name="x" className="h-4 w-4" /> 
              {t("teamAssignment.remove")}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t("teamAssignment.note")}</p>
          {teamResult && (
            <p className="mt-2 text-sm text-muted-foreground">{teamResult}</p>
          )}
        </section>
      )}

      {/* Milestones */}
      <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("detail.milestones")}</h2>
          {milestoneError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {milestoneError}
            </div>
          )}
          {canManageMilestones && (
            <button
              type="button"
              onClick={() => {
                setEditingMilestone(null);
                setMilestoneForm({ name: "", description: "", due_date: "", status: "planned" });
                setShowMilestone(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
            >
              <Icon name="plus" className="h-3.5 w-3.5" />
              {t("actions.addMilestone")}
            </button>
          )}
        </div>
        {milestones.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("detail.noMilestones")}</p>
        ) : (
          <div className="divide-y divide-border">
            {milestones.map((m) => {
              const mpct = m.progress_percent ?? 0;
              const mdone = m.tasks_done_count ?? 0;
              const mtotal = m.tasks_count ?? 0;
              return (
                <div key={m.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{m.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.due_date ?? "—"} · {t(`milestoneStatuses.${m.status}`)}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!canManageMilestones}
                      onClick={() => handleToggleMilestoneVisibility(m)}
                      title={t("portal.clientVisible")}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      <Icon name={m.client_visible !== false ? "eye" : "eye-off"} className="h-4 w-4" />
                    </button>
                    {canManageMilestones && (
                      <ActionMenu
                        items={[
                          {
                            label: t("actions.edit"),
                            icon: "pencil",
                            onClick: () => {
                              setEditingMilestone(m);
                              setMilestoneForm({
                                name: m.name,
                                description: m.description ?? "",
                                due_date: m.due_date ?? "",
                                status: m.status,
                              });
                              setShowMilestone(true);
                            },
                          },
                          {
                            label: t("actions.delete"),
                            icon: "trash-2",
                            danger: true,
                            onClick: () => handleDeleteMilestone(m.id),
                          },
                        ]}
                      />
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, Math.max(0, mpct))}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums">
                      {mpct}% · {mdone}/{mtotal}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Tasks */}
      <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t("detail.tasks")}</h2>
          {taskError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {taskError}
            </div>
          )}
          {canCreateTask && (
            <button
              type="button"
              onClick={() => setShowTask(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
            >
              <Icon name="plus" className="h-3.5 w-3.5" />
              {t("actions.addTask")}
            </button>
          )}
        </div>
        <div className="mb-4 flex flex-wrap gap-3">
          <Select
            value={taskStatus}
            onValueChange={setTaskStatus}
            options={[
              { value: "", label: `${t("filters.all")} ${t("fields.status")}` },
              ...TASK_STATUSES.map((s) => ({ value: s, label: t(`taskStatuses.${s}`) })),
            ]}
            className="w-[190px] max-w-full"
          />
          <Select
            value={taskPriority}
            onValueChange={setTaskPriority}
            options={[
              { value: "", label: `${t("filters.all")} ${t("fields.priority")}` },
              ...TASK_PRIORITIES.map((p) => ({ value: p, label: t(`priorities.${p}`) })),
            ]}
            className="w-[190px] max-w-full"
          />
          <Select
            value={taskAssignee}
            onValueChange={setTaskAssignee}
            options={[
              { value: "", label: `${t("filters.all")} ${t("fields.assignee")}` },
              ...members.map((m) => ({ value: String(m.id), label: m.name })),
            ]}
            className="w-[190px] max-w-full"
          />
          <Select
            value={taskMilestone}
            onValueChange={setTaskMilestone}
            options={[
              { value: "", label: `${t("filters.all")} ${t("fields.milestone")}` },
              ...milestones.map((m) => ({ value: String(m.id), label: m.name })),
            ]}
            className="w-[190px] max-w-full"
          />
        </div>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("detail.noTasks")}</p>
        ) : (
          <div aria-busy={loading} className={loading ? "pointer-events-none opacity-60 transition-opacity" : undefined}>
            <div className="hidden lg:block">
              <DataTable
                framed={false}
                onRowClick={(task) => router.push(`/projects/${id}/tasks/${task.id}`)}
                columns={[
                  {
                    key: "title",
                    header: t("fields.title"),
                    width: "w-[34%]",
                    render: (task) => (
                      <span className="block max-w-full truncate font-medium text-foreground">{task.title}</span>
                    ),
                  },
                  {
                    key: "status",
                    header: t("fields.status"),
                    width: "w-[14%]",
                    render: (task) => (
                      <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(task.status)}`}>
                        {t(`taskStatuses.${task.status}`)}
                      </span>
                    ),
                  },
                  {
                    key: "priority",
                    header: t("fields.priority"),
                    width: "w-[12%]",
                    render: (task) => (
                      <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${priorityBadgeClass(task.priority)}`}>
                        {t(`priorities.${task.priority}`)}
                      </span>
                    ),
                  },
                  {
                    key: "assignee",
                    header: t("fields.assignee"),
                    width: "w-[18%]",
                    render: (task) =>
                      task.assignee ? (
                        <span className="flex min-w-0 items-center gap-2">
                          <Avatar name={task.assignee.name} seed={task.assignee.id} className="h-7 w-7 shrink-0 text-[10px]" />
                          <span className="truncate">{task.assignee.name}</span>
                        </span>
                      ) : (
                        "—"
                      ),
                  },
                  {
                    key: "dueDate",
                    header: t("fields.dueDate"),
                    width: "w-[12%]",
                    cellClassName: "tabular-nums",
                    render: (task) => task.due_date?.slice(0, 10) ?? "—",
                  },
                  {
                    key: "portal",
                    header: t("portal.clientVisible"),
                    width: "w-[8%]",
                    render: (task) => (
                      <button
                        type="button"
                        disabled={!canUpdateTask}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleTaskVisibility(task);
                        }}
                        title={t("portal.clientVisible")}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
                      >
                        <Icon name={task.client_visible !== false ? "eye" : "eye-off"} className="h-4 w-4" />
                      </button>
                    ),
                  },
                  {
                    key: "actions",
                    header: "",
                    width: "w-[10%]",
                    render: (task) =>
                      canDeleteTask ? (
                        <ActionMenu
                          items={[
                            {
                              label: t("actions.delete"),
                              icon: "trash-2",
                              danger: true,
                              onClick: () => handleDeleteTask(task.id),
                            },
                          ]}
                        />
                      ) : null,
                  },
                ]}
                rows={tasks}
                rowKey={(task) => task.id}
              />
            </div>
            <div className="divide-y divide-border lg:hidden">
            {tasks.map((task) => (
              <div
                key={task.id}
                onClick={() => router.push(`/projects/${id}/tasks/${task.id}`)}
                className="flex cursor-pointer flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{task.title}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(task.status)}`}>
                      {t(`taskStatuses.${task.status}`)}
                    </span>
                    <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${priorityBadgeClass(task.priority)}`}>
                      {t(`priorities.${task.priority}`)}
                    </span>
                    {task.assignee ? <span className="text-xs text-muted-foreground">{task.assignee.name}</span> : null}
                    {task.due_date ? <span className="text-xs text-muted-foreground">{task.due_date.slice(0, 10)}</span> : null}
                    {canUpdateTask && (
                      <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${task.client_visible !== false ? "border-slate-200 bg-slate-100 text-slate-700" : "border-slate-200 bg-slate-50 text-slate-400"}`}>
                        <Icon name={task.client_visible !== false ? "eye" : "eye-off"} className="h-3 w-3" />
                        {task.client_visible !== false ? t("portal.clientVisible") : "—"}
                      </span>
                    )}
                  </div>
                </div>
                {(canDeleteTask || canUpdateTask) && (
                  <ActionMenu
                    items={[
                      ...(canUpdateTask ? [{
                        label: t("portal.clientVisible"),
                        icon: task.client_visible !== false ? "eye-off" : "eye",
                        onClick: () => handleToggleTaskVisibility(task),
                      }] : []),
                      ...(canDeleteTask ? [{
                        label: t("actions.delete"),
                        icon: "trash-2",
                        danger: true,
                        onClick: () => handleDeleteTask(task.id),
                      }] : []),
                    ]}
                  />
                )}
              </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Timeline */}
      <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h2 className="text-lg font-semibold">{t("detail.timeline")}</h2>
        {timeline.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("detail.noTasks")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {timeline.map((item, idx) => (
              <li key={`${item.type}-${item.id}-${idx}`} className="flex items-center gap-3 text-sm">
                <span className="w-20 shrink-0 text-xs text-muted-foreground">
                  {item.due_date ?? "—"}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    item.type === "milestone"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {t(`timelineTypes.${item.type}`)}
                </span>
                <span className="truncate">{item.name}</span>
                {item.type === "milestone" && item.progress_percent != null && (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {item.progress_percent}%
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Member modal */}
      {showMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={handleAddMember} className="w-full max-w-sm space-y-4 rounded-lg bg-background p-6 shadow-xl">
            <h2 className="text-lg font-semibold">{t("actions.addMember")}</h2>
            {memberError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {memberError}
              </div>
            )}
            <Select
              value={memberUserId}
              onValueChange={setMemberUserId}
              placeholder={t("selectMember")}
              options={directory
                .filter((u) => !members.some((m) => m.id === u.id))
                .map((u) => ({ value: String(u.id), label: `${u.name} (${u.email})` }))}
              className="w-full"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowMember(false)} className="rounded-md border border-border px-4 py-2 text-sm">
                {t("actions.cancel")}
              </button>
              <button type="submit" disabled={!memberUserId} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
                <Icon name="user-plus" className="h-4 w-4" />
                {t("actions.addMember")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Milestone modal */}
      {showMilestone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={handleSaveMilestone} className="w-full max-w-lg space-y-4 rounded-lg bg-background p-6 shadow-xl">
            <h2 className="text-lg font-semibold">
              {editingMilestone ? t("actions.edit") : t("actions.addMilestone")}
            </h2>
            {milestoneError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {milestoneError}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("fields.name")} <span className="text-red-500" aria-hidden="true">*</span></label>
              <input
                required
                value={milestoneForm.name}
                onChange={(e) => setMilestoneForm({ ...milestoneForm, name: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("fields.description")}</label>
              <textarea
                value={milestoneForm.description}
                onChange={(e) => setMilestoneForm({ ...milestoneForm, description: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                rows={2}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("fields.dueDate")}</label>
                <input
                  type="date"
                  value={milestoneForm.due_date}
                  onChange={(e) => setMilestoneForm({ ...milestoneForm, due_date: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("fields.status")}</label>
                <Select
                  value={milestoneForm.status}
                  onValueChange={(v) => setMilestoneForm({ ...milestoneForm, status: v })}
                  options={MILESTONE_STATUSES.map((s) => ({ value: s, label: t(`milestoneStatuses.${s}`) }))}
                  className="w-full"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowMilestone(false)} className="rounded-md border border-border px-4 py-2 text-sm">
                {t("actions.cancel")}
              </button>
              <button type="submit" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                <Icon name="check" className="h-4 w-4" />
                {t("actions.save")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Task modal */}
      {/* Client Portal (FE-023) */}
      <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h2 className="mb-1 text-lg font-semibold">{t("portal.portalSection")}</h2>
        <p className="mb-4 text-sm text-muted-foreground">{t("portal.sectionDescription")}</p>
        <div className="flex flex-wrap gap-2 border-b border-border mb-4">
          {(["files","discussion","approvals","history"] as const).map((tb) => (
            <button
              key={tb}
              type="button"
              onClick={() => setPortalTab(tb)}
              className={`flex-1 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                portalTab === tb ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(`portal.${tb === "files" ? "files" : tb === "discussion" ? "discussion" : tb === "approvals" ? "approvals" : "history"}`)}
            </button>
          ))}
        </div>
        {portalError && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{portalError}</div>
        )}

        {portalTab === "files" && (
          <div className="space-y-3">
            {canManagePortalFiles && (
              <DropzoneInternal onFile={async (f) => {
                const fd = new FormData();
                fd.append("file", f);
                try {
                  const res = await fetch(`/api/projects/${id}/files`, { method: "POST", body: fd });
                  if (res.ok) {
                    const b = await res.json();
                    setPortalFiles((prev) => [b.data, ...prev]);
                  } else {
                    const b = await res.json().catch(()=>null);
                    setPortalError(b?.error?.message || c("uploadFailed"));
                  }
                } catch { setPortalError(c("uploadFailed")); }
              }} label={t("portal.upload")} />
            )}
            {portalFiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("portal.noFiles")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {portalFiles.map((f: any) => (
                  <li key={f.id} className="flex items-start gap-3 py-3 text-sm">
                    <Icon name={fileIcon(f.original_name, f.mime_type)} className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{f.original_name}</p>
                      {f.uploaded_by && (
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Avatar name={f.uploaded_by.name} seed={f.uploaded_by.id} className="h-5 w-5 shrink-0 text-[9px]" />
                          <span className="truncate"><span className="font-semibold text-foreground">{f.uploaded_by.name}</span> · {String(f.created_at).slice(0, 10)}</span>
                        </p>
                      )}
                      {f.client_visible && (
                        <p className="mt-1 text-xs text-muted-foreground">{t("portal.clientVisible")}</p>
                      )}
                    </div>
                    {canManagePortalFiles && (
                      <button type="button" aria-label={t("portal.clientVisible")} onClick={async () => {
                        await fetch(`/api/projects/${id}/files/${f.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_visible: !f.client_visible }) });
                        setPortalFiles((prev) => prev.map((x) => x.id === f.id ? { ...x, client_visible: !f.client_visible } : x));
                      }} className="shrink-0 text-muted-foreground hover:text-foreground">
                        <Icon name={f.client_visible ? "eye" : "eye-off"} className="h-4 w-4" />
                      </button>
                    )}
                    <ActionMenu
                      items={[
                        {
                          label: t("portal.download"),
                          icon: "download",
                          onClick: () => { window.location.href = `/api/projects/${id}/files/${f.id}/download`; },
                        },
                        ...(canManagePortalFiles
                          ? [{
                              label: t("portal.delete"),
                              icon: "trash-2",
                              danger: true,
                              onClick: async () => {
                                const dr = await fetch(`/api/projects/${id}/files/${f.id}`, { method: "DELETE" });
                                if (dr.ok) setPortalFiles((prev) => prev.filter((x) => x.id !== f.id));
                                else { const b = await dr.json().catch(()=>null); setPortalError(b?.error?.message || c("deleteFailed")); }
                              },
                            }]
                          : []),
                      ]}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {portalTab === "discussion" && (
          <div className="space-y-3">
            {portalComments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("portal.noComments")}</p>
            ) : (
              <ul className="space-y-3">
                {portalComments.map((c: any) => (
                  <li key={c.id} className={`flex gap-3 rounded-xl px-4 py-3 text-sm ${c.author_kind === "client" ? "bg-emerald-50/60" : "bg-violet-50/60"}`}>
                    <Avatar name={c.author?.name ?? (c.author_kind === "client" ? "Client" : "Agency")} seed={c.author_id ?? c.id} className="h-8 w-8 shrink-0 text-xs" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-muted-foreground">{c.author?.name ?? (c.author_kind === "client" ? "Client" : "Agency")} · {String(c.created_at).slice(0, 10)}</p>
                      <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
                      {canManagePortalFiles && (
                        <button type="button" onClick={async () => {
                          await fetch(`/api/projects/${id}/portal-comments/${c.id}`, { method: "DELETE" });
                          setPortalComments((prev) => prev.filter((x) => x.id !== c.id));
                        }} className="inline-flex items-center justify-center gap-1.5 mt-1 text-xs text-red-600 hover:underline"><Icon name="trash-2" className="h-3.5 w-3.5" /> {t("portal.delete")}</button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!portalCommentDraft.trim()) return;
              const res = await fetch(`/api/projects/${id}/portal-comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: portalCommentDraft.trim() }) });
              if (res.ok) { const b = await res.json(); setPortalComments((prev) => [...prev, b.data]); setPortalCommentDraft(""); } else { const b = await res.json().catch(()=>null); setPortalError(b?.error?.message || "Comment failed"); }
            }} className="space-y-2">
              <textarea value={portalCommentDraft} onChange={(e) => setPortalCommentDraft(e.target.value)} rows={3} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder={t("portal.comment")} />
              <div className="flex justify-end">
                <button type="submit" className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
                  <Icon name="send" className="h-4 w-4" />
                  {t("portal.send")}
                </button>
              </div>
            </form>
          </div>
        )}

        {portalTab === "approvals" && (
          <div className="space-y-3">
            {canManagePortalApprovals && (
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!portalApprovalTitle.trim()) return;
                const res = await fetch(`/api/projects/${id}/approvals`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: portalApprovalTitle.trim(), description: portalApprovalDesc.trim() || undefined }) });
                if (res.ok) { const b = await res.json(); setPortalApprovals((prev) => [b.data, ...prev]); setPortalApprovalTitle(""); setPortalApprovalDesc(""); } else { const b = await res.json().catch(()=>null); setPortalError(b?.error?.message || "Approval failed"); }
              }} className="space-y-2 rounded-md bg-muted/30 p-3">
                <input value={portalApprovalTitle} onChange={(e) => setPortalApprovalTitle(e.target.value)} placeholder={t("portal.approvals")} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
                <textarea value={portalApprovalDesc} onChange={(e) => setPortalApprovalDesc(e.target.value)} rows={2} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder={t("fields.description")} />
                <div className="flex justify-end">
                  <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"><Icon name="plus" className="h-4 w-4" /> {t("actions.create")}</button>
                </div>
              </form>
            )}
            {portalApprovals.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("portal.noApprovals")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {portalApprovals.map((a: any) => (
                  <li key={a.id} className="py-4 text-sm first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{a.title}</p>
                      <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${approvalStatusClass(a.status)}`}>{t(`portal.approvalStatuses.${a.status}`)}</span>
                    </div>
                    {a.description && <p className="mt-1 text-muted-foreground">{a.description}</p>}
                    {a.response_comment && a.responded_at && (
                      <div className="mt-3 rounded-lg bg-muted/50 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Icon name="reply" className="h-3.5 w-3.5 text-muted-foreground" />
                          <Avatar name={a.responded_by?.name ?? "Unknown"} seed={a.responded_by?.id ?? 0} className="h-5 w-5 text-[9px]" />
                          <span className="text-xs font-medium">{a.responded_by?.name ?? "Unknown"}</span>
                          <span className="text-xs text-muted-foreground">{new Date(String(a.responded_at)).toLocaleString(locale)}</span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{a.response_comment}</p>
                      </div>
                    )}
                    {canManagePortalApprovals && a.status === "pending" && (
                      <button type="button" onClick={async () => {
                        await fetch(`/api/projects/${id}/approvals/${a.id}`, { method: "DELETE" });
                        setPortalApprovals((prev) => prev.filter((x) => x.id !== a.id));
                      }} className="inline-flex items-center justify-center gap-1.5 mt-2 text-xs text-red-600 hover:underline"><Icon name="trash-2" className="h-3.5 w-3.5" /> {t("actions.delete")}</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {portalTab === "history" && (
          <div className="space-y-2">
            {portalHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("portal.noHistory")}</p>
            ) : (
              <ul className="space-y-3">
                {portalHistory.map((e: any, i: number) => {
                  const d = e as Record<string, unknown>;
                  const actorName = String((d.actor as { name?: string } | null)?.name ?? (d.author as { name?: string } | null)?.name ?? "");
                  const actorId = Number((d.actor as { id?: number } | null)?.id ?? (d.author as { id?: number } | null)?.id ?? 0);
                  const title = String(d.approval_title ?? "");
                  const number = String(d.invoice_number ?? "");
                  const amount = formatMoney(d.amount as string | number, currency, locale) || String(d.amount ?? "");
                  const decisionRaw = String(d.decision ?? "");
                  const excerpt = String(d.body ?? "").slice(0, 80);
                  const excerptDisplay = String(d.body ?? "").length > 80 ? excerpt + "…" : excerpt;
                  let text = "";
                  switch (String(d.type)) {
                    case "comment":
                      text = t("portal.historyTypes.comment", { actor: actorName, excerpt: excerptDisplay });
                      break;
                    case "approval_requested":
                      text = t("portal.historyTypes.approval_requested", { title });
                      break;
                    case "approval_responded": {
                      const decLabel = decisionRaw === "approved" ? t("portal.historyDecisionApproved") : t("portal.historyDecisionChanges");
                      text = t("portal.historyTypes.approval_responded", { actor: actorName, decision: decLabel, title });
                      break;
                    }
                    case "invoice_issued":
                      text = t("portal.historyTypes.invoice_issued", { number, amount });
                      break;
                    case "invoice_paid":
                      text = t("portal.historyTypes.invoice_paid", { number, amount });
                      break;
                    default:
                      text = String(d.type);
                  }
                  return (
                    <li key={i} className="flex gap-3 rounded-xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                      <Avatar name={actorName || "?"} seed={actorId} className="h-8 w-8 shrink-0 text-xs" />
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground">{text}</p>
                        <p className="mt-1 text-xs">{new Date(String(d.occurred_at)).toLocaleString(locale)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </section>

      {showTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={handleCreateTask} className="w-full max-w-lg space-y-4 rounded-lg bg-background p-6 shadow-xl">
            <h2 className="text-lg font-semibold">{t("actions.addTask")}</h2>
            {taskError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {taskError}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("fields.title")} <span className="text-red-500" aria-hidden="true">*</span></label>
              <input
                required
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("fields.description")}</label>
              <textarea
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                rows={3}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("fields.status")}</label>
                <Select
                  value={taskForm.status}
                  onValueChange={(v) => setTaskForm({ ...taskForm, status: v })}
                  options={TASK_STATUSES.map((s) => ({ value: s, label: t(`taskStatuses.${s}`) }))}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("fields.priority")}</label>
                <Select
                  value={taskForm.priority}
                  onValueChange={(v) => setTaskForm({ ...taskForm, priority: v })}
                  options={TASK_PRIORITIES.map((p) => ({ value: p, label: t(`priorities.${p}`) }))}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("fields.assignee")}</label>
                <Select
                  value={taskForm.assignee_id}
                  onValueChange={(v) => setTaskForm({ ...taskForm, assignee_id: v })}
                  options={[
                    { value: "", label: "—" },
                    ...members.map((m) => ({ value: String(m.id), label: m.name })),
                  ]}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("fields.milestone")}</label>
                <Select
                  value={taskForm.milestone_id}
                  onValueChange={(v) => setTaskForm({ ...taskForm, milestone_id: v })}
                  options={[
                    { value: "", label: "—" },
                    ...milestones.map((m) => ({ value: String(m.id), label: m.name })),
                  ]}
                  className="w-full"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium">{t("fields.dueDate")}</label>
                <input
                  type="date"
                  value={taskForm.due_date}
                  onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowTask(false)} className="rounded-md border border-border px-4 py-2 text-sm">
                {t("actions.cancel")}
              </button>
              <button type="submit" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                <Icon name="plus" className="h-4 w-4" />
                {t("actions.create")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}