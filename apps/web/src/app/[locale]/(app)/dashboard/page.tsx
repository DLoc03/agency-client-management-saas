"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Icon } from "@/components/shell/Icon";

export default function DashboardPage() {
  const { session, logout, isLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations("Auth.dashboard");
  const s = useTranslations("Shell");
  const c = useTranslations("Common");

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace("/login");
    }
  }, [isLoading, session, router]);

  if (isLoading || !session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">{c("loading")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome card */}
      <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-bold tracking-tight">
              {t("title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("welcome", { name: session.user.name })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("agency", { agency: session.agency.name })}
            </p>
          </div>

          {/* Role chips — single line (UI_GUIDELINES 5) */}
          <div className="flex flex-wrap gap-2">
            {session.user.roles.map((role) => (
              <span
                key={role}
                className="inline-flex max-w-full items-center whitespace-nowrap rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
                title={role}
              >
                <span className="truncate">{role}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={async () => {
              await logout();
              router.replace("/login");
            }}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Icon name="log-out" className="h-4 w-4" />
            {t("signOut")}
          </button>
        </div>
      </section>

      {/* Stat cards — min-height keeps footer from jumping (UI_GUIDELINES 6) */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { key: "leads", value: "0" },
          { key: "clients", value: "0" },
          { key: "projects", value: "0" },
          { key: "invoices", value: "0" },
        ].map((stat) => (
          <div
            key={stat.key}
            className="flex min-h-[104px] flex-col justify-between rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm"
          >
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {s(`stats.${stat.key}`)}
            </span>
            <span className="text-3xl font-bold tabular-nums">{stat.value}</span>
          </div>
        ))}
      </section>

      {/* Empty state for upcoming data (UI_GUIDELINES 6) */}
      <section className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
        <Icon name="folder-kanban" className="mb-3 h-8 w-8 text-muted-foreground" />
        <h3 className="text-base font-semibold text-foreground">
          {s("empty.title")}
        </h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {s("empty.description")}
        </p>
      </section>

      {/* Mock notice */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        {t("mockNotice")}
      </div>
    </div>
  );
}