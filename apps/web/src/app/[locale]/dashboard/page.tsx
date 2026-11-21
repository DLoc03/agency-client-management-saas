/**
 * Dashboard page — /[locale]/dashboard  (FE-002)
 * Protected route: route guard (middleware or client-side) blocks
 * unauthenticated access and redirects to /login.
 */

"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

export default function DashboardPage() {
  const { session, logout, isLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations("Auth.dashboard");

  // Client-side guard: redirect to /login if no session after hydration
  useEffect(() => {
    if (!isLoading && !session) {
      router.replace("/login");
    }
  }, [isLoading, session, router]);

  if (isLoading || !session) {
    // Show nothing while rehydrating / redirecting
    return null;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-neutral-50 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white px-8 py-10 shadow-sm">
        <h1 className="mb-1 text-2xl font-bold text-neutral-900">{t("title")}</h1>
        <p className="text-neutral-600">
          {t("welcome", { name: session.user.name })}
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          {t("agency", { agency: session.agency.name })}
        </p>

        {/* Roles */}
        <div className="mt-4 flex flex-wrap gap-2">
          {session.user.roles.map((role) => (
            <span
              key={role}
              className="rounded-full bg-indigo-50 px-3 py-0.5 text-xs font-medium text-indigo-700"
            >
              {role}
            </span>
          ))}
        </div>

        {/* Mock banner */}
        <div className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-700 border border-amber-200">
          {t("mockNotice")}
        </div>

        {/* Sign out */}
        <button
          onClick={async () => {
            await logout();
            router.replace("/login");
          }}
          className="mt-6 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition"
        >
          {t("signOut")}
        </button>
      </div>
    </main>
  );
}
