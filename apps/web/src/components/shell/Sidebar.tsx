"use client";

import { usePathname } from "next/navigation";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Icon } from "./Icon";
import { useNavItems } from "./nav-items";

type SidebarProps = {
  onNavigate?: () => void;
  collapsed?: boolean;
};

export function Sidebar({ onNavigate, collapsed }: SidebarProps) {
  const t = useTranslations("Shell");
  const pathname = usePathname();
  const items = useNavItems();

  return (
    <aside
      className={`flex h-full flex-col bg-sidebar-background text-sidebar-foreground ${
        collapsed ? "w-16" : "w-64"
      } transition-[width] duration-200`}
      aria-label={t("sidebarLabel")}
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
          A
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">
              {t("brand")}
            </p>
            <p className="truncate text-xs text-sidebar-muted">
              {t("brandSubtitle")}
            </p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            pathname?.endsWith(item.href) ||
            pathname?.includes(`${item.href}/`);
          const label = t(`nav.${item.key}`);
          if (item.disabled) {
            return (
              <span
                key={item.key}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-muted opacity-60 cursor-not-allowed"
                aria-disabled="true"
                title={t("comingSoon")}
              >
                <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
                {!collapsed && (
                  <span className="ml-auto rounded bg-sidebar-accent px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-sidebar-muted">
                    {t("soon")}
                  </span>
                )}
              </span>
            );
          }
          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              }`}
            >
              <Icon name={item.icon} className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        >
          <Icon name="log-out" className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="truncate">{t("signOut")}</span>}
        </button>
      </div>
    </aside>
  );
}