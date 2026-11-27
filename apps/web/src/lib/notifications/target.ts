import type { NotificationItem } from "./types";

const TASK_TYPES = new Set([
  "task.assigned",
  "task.status_changed",
  "task.commented",
  "reminder.task_due",
  "reminder.task_overdue",
]);

export function notificationTarget(n: NotificationItem): string | null {
  const d = (n.data || {}) as Record<string, unknown>;
  if (TASK_TYPES.has(n.type)) {
    if (d.project_id && d.task_id) {
      return `/projects/${d.project_id}/tasks/${d.task_id}`;
    }
    if (d.project_id) return `/projects/${d.project_id}`;
    return null;
  }
  if (d.invoice_id) return `/invoices/${d.invoice_id}`;
  if (n.type === "reminder.lead_followup" && d.lead_id) return `/leads/${d.lead_id}`;
  if (d.project_id) return `/projects/${d.project_id}`;
  return null;
}
