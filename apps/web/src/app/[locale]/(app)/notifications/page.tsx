"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/lib/auth";
import { useTranslations, useFormatter } from "next-intl";
import { Icon } from "@/components/shell/Icon";
import { Forbidden, isForbiddenError } from "@/components/ui/Forbidden";
import { Pagination } from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDelayedSkeleton } from "@/components/ui/Skeleton";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadCount,
  type NotificationItem,
} from "@/lib/notifications/api";
import { notificationTarget } from "@/lib/notifications/target";

const PAGE_SIZE_DEFAULT = 10;

export default function NotificationsPage() {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations("Notifications");
  const tp = useTranslations("Projects");
  const tf = useTranslations("Finance");
  const format = useFormatter();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PAGE_SIZE_DEFAULT);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [count, setCount] = useState(0);

  const showSkeleton = useDelayedSkeleton(loading && !hasLoaded);
  const refetching = loading && hasLoaded;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listNotifications({
        page,
        per_page: perPage,
        ...(unreadOnly ? { unread: 1 } : {}),
      });
      setItems(res.data || []);
      setTotal(res.meta?.total ?? res.data?.length ?? 0);
      setLastPage(res.meta?.last_page ?? 1);
      setHasLoaded(true);
      setForbidden(false);
      try {
        setCount(await getUnreadCount());
      } catch {
        /* ignore */
      }
    } catch (e) {
      const err = e as { status?: number; message?: string };
      if (err.status === 403 || isForbiddenError(e)) {
        setForbidden(true);
      } else {
        setError(err.message || t("empty"));
      }
    } finally {
      setLoading(false);
    }
  }, [page, perPage, unreadOnly, t]);

  useEffect(() => {
    if (session) load();
  }, [session, load]);

  useEffect(() => {
    setPage(1);
  }, [unreadOnly]);

  useEffect(() => {
    if (page > lastPage) setPage(lastPage);
  }, [page, lastPage]);

  const contentOf = (n: NotificationItem): string => {
    const d = (n.data || {}) as Record<string, unknown>;
    const actor = String(d.actor_name ?? "");
    const task = String(d.task_title ?? "");
    const invoice = String(d.invoice_number ?? "");
    const milestone = String(d.milestone_name ?? d.milestone_title ?? "");
    const lead = String(d.lead_name ?? "");
    const from = d.from_status ? safeTaskStatus(tp, String(d.from_status)) : String(d.from_status ?? "");
    const to = d.to_status ? safeTaskStatus(tp, String(d.to_status)) : String(d.to_status ?? "");
    const status = d.to_status ? safeFinanceStatus(tf, String(d.to_status)) : String(d.to_status ?? "");
    switch (n.type) {
      case "task.assigned":
        return t("types.task_assigned", { actor, task });
      case "task.status_changed":
        return t("types.task_status_changed", { actor, task, from, to });
      case "task.commented":
        return t("types.task_commented", { actor, task });
      case "invoice.status_changed":
        return t("types.invoice_status_changed", { invoice, status });
      case "reminder.task_due":
        return t("types.reminder_task_due", { task });
      case "reminder.task_overdue":
        return t("types.reminder_task_overdue", { task });
      case "reminder.milestone_due":
        return t("types.reminder_milestone_due", { milestone });
      case "reminder.milestone_overdue":
        return t("types.reminder_milestone_overdue", { milestone });
      case "reminder.lead_followup":
        return t("types.reminder_lead_followup", { lead });
      case "reminder.invoice_overdue":
        return t("types.reminder_invoice_overdue", { invoice });
      default:
        return n.type;
    }
  };

  const handleClick = async (n: NotificationItem) => {
    if (!n.read_at) {
      setCount((c) => Math.max(0, c - 1));
      setItems((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)),
      );
      try {
        await markNotificationRead(n.id);
      } catch {
        /* ignore */
      }
    }
    const to = notificationTarget(n);
    if (to) router.push(to);
  };

  const handleMarkAll = async () => {
    setCount(0);
    setItems((prev) =>
      prev.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })),
    );
    try {
      await markAllNotificationsRead();
    } catch {
      /* ignore */
    }
    await load();
  };

  if (isLoading || !session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <Forbidden />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            {t("unreadOnly")}
          </label>
          <button
            type="button"
            onClick={handleMarkAll}
            disabled={count === 0}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {t("markAllRead")}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="min-h-[320px]">
        {loading && !hasLoaded ? (
          showSkeleton ? (
            <div className="space-y-2">
              {[...Array(perPage)].map((_, i) => (
                <div
                  key={i}
                  className="flex gap-3 rounded-lg border border-border bg-card p-4 animate-pulse"
                >
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-secondary" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-secondary rounded w-3/4" />
                    <div className="h-3 bg-secondary rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="min-h-[240px]" />
          )
        ) : items.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
            <Icon name="bell" className="mb-3 h-8 w-8 text-muted-foreground" />
            <h3 className="text-base font-semibold text-foreground">{t("empty")}</h3>
          </div>
        ) : (
          <div aria-busy={refetching} className={refetching ? "pointer-events-none opacity-60 transition-opacity" : undefined}>
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {items.map((n) => {
                const unread = !n.read_at;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleClick(n)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
                    >
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          unread ? "bg-primary" : "bg-transparent"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm text-foreground">
                          {contentOf(n)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {n.created_at ? format.relativeTime(new Date(n.created_at)) : ""}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-6">
              <Pagination
                page={page}
                perPage={perPage}
                total={total}
                lastPage={lastPage}
                onPageChange={setPage}
                onPerPageChange={(v) => {
                  setPerPage(v);
                  setPage(1);
                }}
                disabled={loading}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function safeTaskStatus(tp: ReturnType<typeof useTranslations>, key: string): string {
  try {
    return tp(`taskStatuses.${key}`);
  } catch {
    return key;
  }
}

function safeFinanceStatus(tf: ReturnType<typeof useTranslations>, key: string): string {
  try {
    return tf(`statuses.${key}`);
  } catch {
    return key;
  }
}
