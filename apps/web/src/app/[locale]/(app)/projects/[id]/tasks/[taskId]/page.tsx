"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useRouter as useI18nRouter } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { Icon } from "@/components/shell/Icon";
import { Select } from "@/components/ui/Select";
import {
  getTask,
  updateTask,
  listChecklist,
  addChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  listComments,
  addComment,
  deleteComment,
} from "@/lib/projects/api";
import type { Task, TaskStatus, TaskPriority, ChecklistItem, TaskComment } from "@/lib/projects/types";

const TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "in_review", "done"];
const TASK_PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];

export default function TaskDetailPage() {
  const params = useParams();
  const projectId = Number(params?.id);
  const taskId = Number(params?.taskId);

  const { session, isLoading } = useAuth();
  const router = useI18nRouter();
  const t = useTranslations("Projects");
  const c = useTranslations("Common");

  const [task, setTask] = useState<Task | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newChecklist, setNewChecklist] = useState("");
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    if (!isLoading && !session) router.replace("/login");
  }, [isLoading, session, router]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tk, cl, cm] = await Promise.all([
        getTask(taskId),
        listChecklist(taskId),
        listComments(taskId),
      ]);
      setTask(tk);
      setChecklist(cl);
      setComments(cm);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session && taskId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, taskId]);

  const canUpdate = !!session?.user.permissions.includes("tasks.update");
  const canComment = !!session?.user.permissions.includes("tasks.comments.manage");
  const canDeleteComment = (comment: TaskComment) =>
    comment.author?.id === session?.user.id ||
    session?.user.roles.includes("agency_owner") ||
    session?.user.roles.includes("admin");

  const handleStatusChange = async (status: TaskStatus) => {
    try {
      const updated = await updateTask(taskId, { status });
      setTask(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.updateFailed"));
    }
  };

  const handleAddChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklist.trim()) return;
    try {
      const item = await addChecklistItem(taskId, newChecklist.trim());
      setChecklist((prev) => [...prev, item]);
      setNewChecklist("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.updateFailed"));
    }
  };

  const handleToggleChecklist = async (item: ChecklistItem) => {
    try {
      const updated = await updateChecklistItem(taskId, item.id, { is_done: !item.is_done });
      setChecklist((prev) => prev.map((x) => (x.id === item.id ? updated : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.updateFailed"));
    }
  };

  const handleDeleteChecklist = async (itemId: number) => {
    try {
      await deleteChecklistItem(taskId, itemId);
      setChecklist((prev) => prev.filter((x) => x.id !== itemId));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.deleteFailed"));
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      const comment = await addComment(taskId, newComment.trim());
      setComments((prev) => [comment, ...prev]);
      setNewComment("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.updateFailed"));
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      await deleteComment(taskId, commentId);
      setComments((prev) => prev.filter((x) => x.id !== commentId));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.deleteFailed"));
    }
  };

  if (isLoading || !session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">{c("loading")}</p>
      </div>
    );
  }

  if (loading || !task) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">{c("loading")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push(`/projects/${projectId}`)}
          className="rounded-md border border-border px-3 py-1.5 text-sm"
        >
          {t("actions.back")}
        </button>
        <h1 className="text-2xl font-bold tracking-tight">{task.title}</h1>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">{t("detail.overview")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">{t("fields.status")}</p>
            {canUpdate ? (
              <Select
                value={task.status}
                onValueChange={(v) => handleStatusChange(v as TaskStatus)}
                options={TASK_STATUSES.map((s) => ({ value: s, label: t(`taskStatuses.${s}`) }))}
                className="mt-1 w-[170px]"
              />
            ) : (
              <p className="font-medium">{t(`taskStatuses.${task.status}`)}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("fields.priority")}</p>
            <p className="font-medium">{t(`priorities.${task.priority}`)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("fields.assignee")}</p>
            <p className="font-medium">{task.assignee?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("fields.dueDate")}</p>
            <p className="font-medium">{task.due_date ? task.due_date.slice(0, 10) : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("fields.milestone")}</p>
            <p className="font-medium">{task.milestone?.name ?? "—"}</p>
          </div>
        </div>
        {task.description && (
          <p className="mt-4 text-sm text-muted-foreground whitespace-pre-wrap">
            {task.description}
          </p>
        )}
      </section>

      {/* Checklist */}
      <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">{t("task.checklist")}</h2>
        <form onSubmit={handleAddChecklist} className="mb-4 flex gap-2">
          <input
            value={newChecklist}
            onChange={(e) => setNewChecklist(e.target.value)}
            placeholder={t("actions.addChecklist")}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            {t("actions.addChecklist")}
          </button>
        </form>
        {checklist.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("task.noChecklist")}</p>
        ) : (
          <ul className="space-y-2">
            {checklist.map((item) => (
              <li key={item.id} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={item.is_done}
                  onChange={() => handleToggleChecklist(item)}
                  className="h-4 w-4"
                />
                <span className={item.is_done ? "text-muted-foreground line-through" : ""}>
                  {item.title}
                </span>
                {canUpdate && (
                  <button
                    type="button"
                    onClick={() => handleDeleteChecklist(item.id)}
                    className="ml-auto text-xs text-red-600 hover:underline"
                  >
                    {t("actions.delete")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Comments */}
      <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">{t("task.comments")}</h2>
        {canComment && (
          <form onSubmit={handleAddComment} className="mb-4 space-y-2">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder={t("actions.addComment")}
            />
            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
              >
                {t("actions.addComment")}
              </button>
            </div>
          </form>
        )}
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("task.noComments")}</p>
        ) : (
          <ul className="space-y-3">
            {comments.map((comment) => (
              <li key={comment.id} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {comment.author?.name ?? "—"}
                    {comment.created_at ? ` · ${comment.created_at.slice(0, 10)}` : ""}
                  </p>
                  {canDeleteComment(comment) && (
                    <button
                      type="button"
                      onClick={() => handleDeleteComment(comment.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      {t("actions.delete")}
                    </button>
                  )}
                </div>
                <p className="mt-1 text-sm whitespace-pre-wrap">{comment.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}