/**
 * Login page — /[locale]/login  (FE-002)
 * Public route. Redirects to /dashboard if already authenticated.
 */

import { LocaleSwitcher } from "@/components/auth/LocaleSwitcher";
import { LoginForm } from "@/components/auth/LoginForm";
import { useTranslations } from "next-intl";

export default function LoginPage() {
  const t = useTranslations("Auth.login");

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="rounded-2xl border border-neutral-200 bg-white px-8 py-10 shadow-sm">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              {t("title")}
            </h1>
            <p className="mt-1.5 text-sm text-neutral-500">{t("subtitle")}</p>
          </div>

          <LoginForm />
        </div>

        {/* Locale switcher below the card */}
        <div className="mt-5 flex justify-center">
          <LocaleSwitcher />
        </div>
      </div>
    </main>
  );
}
