"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations, useFormatter } from "next-intl";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadCount,
  type NotificationItem,
} from "@/lib/notifications/api";

function targetOf(n: NotificationItem): string | null {
  const d = (n.data || {}) as Record<string, unknown>;
  if (d.invoice_id) return `/invoices/${d.invoice_id}`;
  if (d.project_id) return `/projects/${d.project_id}`;
  if (n.type === "reminder.lead_followup" && d.lead_id) return `/leads/${d.lead_id}`;
  return null;
}

export function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("Notifications");
  const tp = useTranslations("Projects");
  const tf = useTranslations("Finance");
  const format = useFormatter();

  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(async () => {
    try {
      setCount(await getUnreadCount());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refreshCount();
  }, [refreshCount, pathname]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshCount();
    }, 60000);
    const onVis = () => {
      if (document.visibilityState === "visible") refreshCount();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refreshCount]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    listNotifications({ per_page: 10 })
      .then((res) => {
        if (cancelled) return;
        setItems(res.data || []);
      })
      .catch(() => {
        if (cancelled) return;
        setError(t("empty"));
        setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, t]);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const btn = buttonRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      setPos({
        top: r.bottom + 8,
        right: Math.max(8, window.innerWidth - r.right),
      });
    };
    place();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const contentOf = (n: NotificationItem): string => {
    const d = (n.data || {}) as Record<string, unknown>;
    const actor = String(d.actor_name ?? "");
    const task = String(d.task_title ?? "");
    const invoice = String(d.invoice_number ?? "");
    const milestone = String(d.milestone_name ?? d.milestone_title ?? "");
    const lead = String(d.lead_name ?? "");
    const from = d.from_status ? safeTaskStatus(tp, String(d.from_status)) : String(d.from_status ?? "");
    const to = d.to_status ? safeTaskStatus(tp, String(d.to_status)) : String(d.to_status ?? "");
    const status = d.to_status ? tfSafe(tf, String(d.to_status)) : String(d.to_status ?? "");
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
    setOpen(false);
    const to = targetOf(n);
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
  };

  const badgeLabel = count > 99 ? "99+" : String(count);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("title")}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent/50"
      >
        <Icon name="bell" className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
            {badgeLabel}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              top: pos?.top ?? 64,
              right: pos?.right ?? 8,
              width: "min(360px, calc(100vw - 16px))",
            }}
            className="z-50 overflow-hidden rounded-lg border border-border bg-card shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold text-foreground">{t("title")}</span>
              <button
                type="button"
                onClick={handleMarkAll}
                disabled={count === 0}
                className="text-xs font-medium text-primary hover:underline disabled:opacity-50 disabled:no-underline"
              >
                {t("markAllRead")}
              </button>
            </div>

            <div className="max-h-[420px] overflow-y-auto">
              {loading && items.length === 0 ? (
                <div className="space-y-2 p-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex gap-3 rounded-md p-2">
                      <Skeleton className="mt-1 h-2 w-2 shrink-0 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {t("empty")}
                </div>
              ) : (
                <ul className="divide-y divide-border">
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
                              {n.created_at
                                ? format.relativeTime(new Date(n.created_at))
                                : ""}
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="border-t border-border px-4 py-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push("/notifications");
                }}
                className="text-xs font-medium text-primary hover:underline"
              >
                {t("viewAll")}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function safeTaskStatus(tp: ReturnType<typeof useTranslations>, key: string): string {
  try {
    return tp(`taskStatuses.${key}`);
  } catch {
    return key;
  }
}

function tfSafe(tf: ReturnType<typeof useTranslations>, key: string): string {
  try {
    return tf(`statuses.${key}`);
  } catch {
    return key;
  }
}
