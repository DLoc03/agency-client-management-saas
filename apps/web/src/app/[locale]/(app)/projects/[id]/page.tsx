"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useRouter as useI18nRouter } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { Icon } from "@/components/shell/Icon";
import { Select } from "@/components/ui/Select";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { DataTable } from "@/components/ui/DataTable";
import { Skeleton } from "@/components/ui/Skeleton";
import { statusBadgeClass } from "@/lib/status-colors";
import { Avatar } from "@/components/ui/Avatar";
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

export default function ProjectDetailPage() {
  const params = useParams();
  const id = Number(params?.id);
  const { session, isLoading } = useAuth();
  const router = useI18nRouter();
  const locale = useLocale();
  const t = useTranslations("Projects");
  const c = useTranslations("Common");

  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<{ id: number; name: string; email: string }[]>([]);
  const [directory, setDirectory] = useState<{ id: number; name: string; email: string }[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (session?.user.permissions.includes("projects.update")) {
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
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.loadFailed"));
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

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addMember(id, Number(memberUserId));
      setMemberUserId("");
      setShowMember(false);
      const m = await listMembers(id);
      setMembers(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.updateFailed"));
    }
  };

  const handleRemoveMember = async (userId: number) => {
    try {
      await removeMember(id, userId);
      setMembers((prev) => prev.filter((m) => m.id !== userId));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.updateFailed"));
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
      setError(e instanceof Error ? e.message : t("errors.updateFailed"));
    }
  };

  const handleDeleteMilestone = async (milestoneId: number) => {
    if (!confirm("Delete milestone?")) return;
    try {
      await deleteMilestone(id, milestoneId);
      setMilestones((prev) => prev.filter((m) => m.id !== milestoneId));
      const tl = await getTimeline(id);
      setTimeline(tl);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.deleteFailed"));
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
      setError(e instanceof Error ? e.message : t("errors.createFailed"));
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm("Delete task?")) return;
    try {
      await deleteTask(taskId);
      await loadTasks();
      const p = await getProject(id);
      setProject(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.deleteFailed"));
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
      setError(e instanceof Error ? e.message : t("errors.updateFailed"));
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
      setError(e instanceof Error ? e.message : t("errors.updateFailed"));
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
    if (!loading) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-sm text-muted-foreground">{error ?? c("loading")}</p>
        </div>
      );
    }
    // First load: geometric skeleton of the detail layout (DEC-021).
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
        <section className="space-y-3 rounded-lg border border-border bg-card p-6 shadow-sm">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
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
              if (!confirm("Delete project?")) return;
              try {
                await deleteProject(id);
                router.push("/projects");
              } catch (e) {
                setError(e instanceof Error ? e.message : t("errors.deleteFailed"));
              }
            }}
            className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
          >
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

      {/* Members */}
      <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("detail.members")}</h2>
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
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {t("teamAssignment.assign")}
            </button>
            <button
              type="button"
              onClick={handleRemoveTeam}
              disabled={!teamAssignId}
              className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-600 disabled:opacity-60"
            >
              {t("teamAssignment.remove")}
            </button>
          </div>
          {teamResult && (
            <p className="mt-2 text-sm text-muted-foreground">{teamResult}</p>
          )}
        </section>
      )}

      {/* Milestones */}
      <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("detail.milestones")}</h2>
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
          <div className="space-y-3">
            {milestones.map((m) => {
              const mpct = m.progress_percent ?? 0;
              const mdone = m.tasks_done_count ?? 0;
              const mtotal = m.tasks_count ?? 0;
              return (
                <div key={m.id} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{m.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.due_date ?? "—"} · {t(`milestoneStatuses.${m.status}`)}
                      </p>
                    </div>
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
                columns={[
                  {
                    key: "title",
                    header: t("fields.title"),
                    width: "w-[34%]",
                    render: (task) => (
                      <button
                        type="button"
                        onClick={() => router.push(`/projects/${id}/tasks/${task.id}`)}
                        className="block max-w-full truncate text-left font-medium text-foreground hover:underline"
                      >
                        {task.title}
                      </button>
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
                    render: (task) => t(`priorities.${task.priority}`),
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
            <div className="space-y-2 lg:hidden">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
              >
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => router.push(`/projects/${id}/tasks/${task.id}`)}
                    className="block max-w-full truncate text-left font-medium text-foreground hover:underline"
                  >
                    {task.title}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {t(`taskStatuses.${task.status}`)} · {t(`priorities.${task.priority}`)}
                    {task.assignee ? ` · ${task.assignee.name}` : ""}
                    {task.due_date ? ` · ${task.due_date.slice(0, 10)}` : ""}
                  </p>
                </div>
                {canDeleteTask && (
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
              <button type="submit" disabled={!memberUserId} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
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
              <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                {t("actions.save")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Task modal */}
      {showTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={handleCreateTask} className="w-full max-w-lg space-y-4 rounded-lg bg-background p-6 shadow-xl">
            <h2 className="text-lg font-semibold">{t("actions.addTask")}</h2>
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
              <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                {t("actions.create")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}