/**
 * Portal Forgot Password Page — /[locale]/portal/forgot-password (FE-003)
 */

import { PortalForgotPasswordForm } from "@/components/portal/PortalForgotPasswordForm";
import { useTranslations } from "next-intl";

export default function PortalForgotPasswordPage() {
  const t = useTranslations("Portal.forgotPassword");

  return (
    <main className="flex min-h-[calc(100vh-140px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {t("title")}
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">{t("subtitle")}</p>
          </div>

          <PortalForgotPasswordForm />
        </div>
      </div>
    </main>
  );
}
