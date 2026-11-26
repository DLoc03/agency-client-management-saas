/**
 * Login page — /[locale]/login  (FE-002; UI refresh FE-017)
 * Public route. Redirects to /dashboard if already authenticated.
 * Layout per the PO-approved "L2 — Centered card" sample (2026-11-25):
 * slim header (back to home + language), one centered card with the
 * logo, the form, and a Client Portal cross-link at the bottom.
 */

import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { LoginForm } from "@/components/auth/LoginForm";
import { Logo } from "@/components/shell/Logo";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  const t = await getTranslations("Auth.login");
  const home = await getTranslations("Home");
  const shell = await getTranslations("Shell");
  const locale = await getLocale();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 md:px-10">
        <Link
          href="/"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← {t("backHome")}
        </Link>
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/login" locale="en" className={locale === "en" ? "font-semibold text-foreground" : "hover:text-foreground"}>
            English
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/login" locale="vi" className={locale === "vi" ? "font-semibold text-foreground" : "hover:text-foreground"}>
            Tiếng Việt
          </Link>
        </span>
      </header>

      {/* Centered card */}
      <main className="flex flex-1 items-center justify-center px-4 py-6">
        <div className="w-full max-w-[392px] rounded-2xl border border-border bg-card px-8 py-9 shadow-[0_20px_50px_rgba(23,18,46,0.07)]">
          <div className="mb-7 text-center">
            <Logo variant="violet" className="mx-auto h-11 w-11" />
            <h1 className="mt-5 text-[21px] font-extrabold tracking-tight">
              {t("heading")}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>

          <LoginForm redirectTo={returnTo} />

          {/* Client Portal cross-link */}
          <p className="mt-6 border-t border-border pt-5 text-center text-sm text-muted-foreground">
            {t("portalPrompt")}{" "}
            <Link
              href="/portal/login"
              className="border-b border-border pb-0.5 font-semibold text-foreground transition-colors hover:border-primary hover:text-primary-text"
            >
              {t("portalLink")} →
            </Link>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 text-center text-xs text-muted-foreground md:px-10">
        © 2026 {shell("brand")} · {home("footerNote")}
      </footer>
    </div>
  );
}
