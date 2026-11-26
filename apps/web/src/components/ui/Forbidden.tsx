"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

/**
 * Full-page state for a 403 (DEC-025): when the signed-in role has no
 * permission for a section, the page explains that in the UI language
 * instead of surfacing the raw API error message.
 */
export function Forbidden() {
  const c = useTranslations("Common");
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <div className="w-full max-w-md space-y-3 rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold">{c("forbidden.title")}</h2>
        <p className="text-sm text-muted-foreground">{c("forbidden.body")}</p>
        <Link
          href="/dashboard"
          className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          {c("forbidden.back")}
        </Link>
      </div>
    </div>
  );
}

export function isForbiddenError(err: unknown): boolean {
  const e = err as { code?: string; status?: number } | null;
  return !!e && (e.code === "FORBIDDEN" || e.status === 403);
}
