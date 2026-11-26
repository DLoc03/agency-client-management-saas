"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/components/shell/Icon";

type ForbiddenProps = {
  /** Override the title (defaults to Common.forbidden.title). */
  title?: string;
  /** Override the description (defaults to Common.forbidden.message). */
  message?: string;
};

/**
 * Shared 403 "no permission" page (DEC-025). Rendered wherever the current
 * membership lacks the permission to access a route or action. All copy is
 * translated via the Common namespace — never hardcoded.
 */
export function Forbidden({ title, message }: ForbiddenProps = {}) {
  const c = useTranslations("Common");
  return (
    <div className="mx-auto max-w-md px-6 py-12 text-center">
      <Icon name="shield-alert" className="mx-auto h-12 w-12 text-muted-foreground" />
      <h2 className="mt-4 text-xl font-bold text-foreground">
        {title || c("forbidden.title") || "Forbidden"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {message || c("forbidden.message") || "You don't have permission to access this page."}
      </p>
    </div>
  );
}
