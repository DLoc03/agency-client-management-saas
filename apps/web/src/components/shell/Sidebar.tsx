"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Link, useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { Icon } from "./Icon";
import { useNavItems } from "./nav-items";

type SidebarProps = {
  onNavigate?: () => void;
};

export function Sidebar({ onNavigate }: SidebarProps) {
  const t = useTranslations("Shell");
  const pathname = usePathname();
  const items = useNavItems();
  const { session, logout } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const roleLabel = (role: string) => {
    const key = `roles.${role}`;
    try {
      return t(key as never);
    } catch {
      return role;
    }
  };

  const initials = (session?.user.name ?? "?")
    .split(" ")
    .map((p) => p.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside
      className="flex h-screen w-64 shrink-0 flex-col bg-sidebar-background text-sidebar-foreground"
      aria-label={t("sidebarLabel")}
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
          A
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{t("brand")}</p>
          <p className="truncate text-xs text-sidebar-muted">{t("brandSubtitle")}</p>
        </div>
      </div>

      {/* Nav (scrolls internally) */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            pathname?.endsWith(item.href) ||
            pathname?.includes(`${item.href}/`);
          const label = t(`nav.${item.key}` as never);
          if (item.disabled) {
            return (
              <span
                key={item.key}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-muted opacity-60 cursor-not-allowed"
                aria-disabled="true"
                title={t("comingSoon")}
              >
                <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                <span className="truncate">{label}</span>
                <span className="ml-auto rounded bg-sidebar-accent px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-sidebar-muted">
                  {t("soon")}
                </span>
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
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User block at the foot */}
      <div className="relative border-t border-sidebar-border p-3" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-sidebar-accent/60"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sm font-semibold text-sidebar-accent-foreground">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {session?.user.name ?? t("brand")}
            </p>
            <p className="truncate text-xs text-sidebar-muted">
              {session ? roleLabel(session.user.roles[0] ?? "") : ""}
            </p>
          </div>
          <Icon name="chevron-left" className={`h-4 w-4 shrink-0 text-sidebar-muted transition-transform ${menuOpen ? "rotate-90" : "-rotate-90"}`} />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute bottom-full left-3 right-3 mb-2 overflow-hidden rounded-md border border-sidebar-border bg-sidebar-background shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              disabled
              className="flex w-full items-center px-3 py-2 text-left text-sm text-sidebar-muted opacity-60 cursor-not-allowed"
              title={t("comingSoon")}
            >
              {t("userMenu.profile")}
            </button>
            <button
              type="button"
              role="menuitem"
              disabled
              className="flex w-full items-center px-3 py-2 text-left text-sm text-sidebar-muted opacity-60 cursor-not-allowed"
              title={t("comingSoon")}
            >
              {t("userMenu.workspaceSettings")}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={async () => {
                setMenuOpen(false);
                await logout();
                router.replace("/login");
              }}
              className="flex w-full items-center px-3 py-2 text-left text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent/60"
            >
              {t("userMenu.signOut")}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}