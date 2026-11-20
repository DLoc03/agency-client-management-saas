/**
 * Portal Dashboard Page — /[locale]/portal (FE-003)
 * Protected portal route with route guard.
 * Shows empty dashboard placeholder per i18n.
 */

"use client";

import { useRouter } from "@/i18n/routing";
import { usePortalAuth } from "@/lib/portal-auth";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

export default function PortalDashboardPage() {
  const { session, logout, isLoading } = usePortalAuth();
  const router = useRouter();
  const t = useTranslations("Portal.dashboard");

  // Client-side guard for portal
  useEffect(() => {
    if (!isLoading && !session) {
      router.replace("/portal/login");
    }
  }, [isLoading, session, router]);

  if (isLoading || !session) {
    return null;
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        {/* Header */}
        <div className="flex flex-col gap-1 border-b border-slate-100 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {t("title")}
            </h1>
            <p className="mt-1 text-base text-slate-700">
              {t("welcome", { name: session.client.name })}
            </p>
            <p className="text-xs text-slate-500">
              {t("agency", { agency: session.agency.name })} •{" "}
              {t("clientId", { id: session.client.client_id ?? session.client.id })}
            </p>
          </div>

          <button
            onClick={() => {
              logout();
              router.replace("/portal/login");
            }}
            className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:mt-0"
          >
            {t("signOut")}
          </button>
        </div>

        {/* Empty state placeholder */}
        <div className="my-12 flex flex-col items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-4">
            <svg
              className="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="max-w-md text-sm text-slate-600">
            {t("emptyNotice")}
          </p>
        </div>

        {/* Mock notice */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          {t("mockNotice")}
        </div>
      </div>
    </main>
  );
}
