/**
 * Semantic colors for status badges (Product Owner feedback, acceptance
 * round 2): a status must be recognizable by color at a glance, with the
 * label text kept dark enough to read on the tinted background.
 * Pair with: whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium
 */
const TONES: Record<string, string> = {
  // Positive / healthy
  active: "border-green-200 bg-green-100 text-green-800",
  done: "border-green-200 bg-green-100 text-green-800",
  completed: "border-green-200 bg-green-100 text-green-800",
  paid: "border-green-200 bg-green-100 text-green-800",
  // In motion
  in_progress: "border-blue-200 bg-blue-100 text-blue-800",
  in_review: "border-blue-200 bg-blue-100 text-blue-800",
  contacted: "border-blue-200 bg-blue-100 text-blue-800",
  sent: "border-blue-200 bg-blue-100 text-blue-800",
  qualified: "border-violet-200 bg-violet-100 text-violet-800",
  // Neutral / not started
  draft: "border-slate-300 bg-slate-100 text-slate-700",
  new: "border-slate-300 bg-slate-100 text-slate-700",
  todo: "border-slate-300 bg-slate-100 text-slate-700",
  planned: "border-slate-300 bg-slate-100 text-slate-700",
  // Attention
  on_hold: "border-amber-200 bg-amber-100 text-amber-800",
  paused: "border-amber-200 bg-amber-100 text-amber-800",
  // Negative / ended badly
  overdue: "border-red-200 bg-red-100 text-red-800",
  unqualified: "border-red-200 bg-red-100 text-red-800",
  churned: "border-red-200 bg-red-100 text-red-800",
  cancelled: "border-red-200 bg-red-100 text-red-800",
  inactive: "border-red-200 bg-red-100 text-red-800",
};

export function statusBadgeClass(status: string): string {
  return TONES[status] ?? "border-border bg-secondary text-secondary-foreground";
}
