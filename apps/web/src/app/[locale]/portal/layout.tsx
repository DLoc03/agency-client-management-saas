/**
 * Client Portal Layout — FE-003
 * Distinct layout from internal agency app:
 * - Dedicated Portal branding (Client Portal)
 * - PortalAuthProvider context
 * - Language switcher
 */

import { LocaleSwitcher } from "@/components/auth/LocaleSwitcher";
import { PortalAuthProvider } from "@/lib/portal-auth";
import { Logo } from "@/components/shell/Logo";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

export default function PortalLayout({ children }: { children: ReactNode }) {
  const t = useTranslations("Portal");

  return (
    <PortalAuthProvider>
      <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
        {/* Portal-specific top navigation bar */}
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <Logo variant="emerald" className="h-8 w-8" />
              <span className="text-lg font-bold tracking-tight text-slate-800">
                {t("brand")}
              </span>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                Partner Access
              </span>
            </div>

            <LocaleSwitcher />
          </div>
        </header>

        {/* Content */}
        <div className="flex-1">{children}</div>

        {/* Portal-specific footer */}
        <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
          Brewbase — Client Portal
        </footer>
      </div>
    </PortalAuthProvider>
  );
}
