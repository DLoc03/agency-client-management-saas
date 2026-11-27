"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";

const TABS = [
  { segment: "teams", href: "/team/teams", labelKey: "teams" },
  { segment: "members", href: "/team/members", labelKey: "members" },
  { segment: "invitations", href: "/team/invitations", labelKey: "invitations" },
  { segment: "workload", href: "/team/workload", labelKey: "workload.title" },
] as const;

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Teams");
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <nav
        aria-label={t("title")}
        className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border"
      >
        {TABS.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.segment}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              {t(tab.labelKey)}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
