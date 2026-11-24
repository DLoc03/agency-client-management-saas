"use client";

import { useTranslations } from "next-intl";

export type NavItem = {
  key: string;
  href: string;
  icon: string;
  disabled?: boolean;
};

/**
 * Navigation for the internal app shell (Classic Sidebar, DEC-013).
 * Only routes that actually exist are enabled; upcoming modules are shown
 * as disabled placeholders so the shell stays stable as features land.
 */
export function useNavItems(): NavItem[] {
  const t = useTranslations("Shell.nav");
  return [
    { key: "dashboard", href: "/dashboard", icon: "layout-dashboard" },
    { key: "leads", href: "/leads", icon: "users" },
    { key: "clients", href: "/clients", icon: "building-2" },
    { key: "projects", href: "/projects", icon: "folder-kanban" },
    { key: "team", href: "/team/teams", icon: "users" },
    { key: "tasks", href: "/tasks", icon: "check-square", disabled: true },
    { key: "invoices", href: "/invoices", icon: "receipt", disabled: true },
  ];
}