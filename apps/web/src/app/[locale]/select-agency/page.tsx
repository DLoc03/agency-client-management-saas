/**
 * Select agency page — /[locale]/select-agency (FE-014)
 * Public route shown only when login returned a short-lived selection token.
 * Uses the L2 "Centered card" frame from the sign-in page (FE-017).
 */

"use client";

import { Link, useRouter } from "@/i18n/routing";
import { Icon } from "@/components/shell/Icon";
import { Logo } from "@/components/shell/Logo";
import {
  clearSelection,
  loadSelection,
  useAuth,
  type AgencyMembership,
  type AgencySelection,
} from "@/lib/auth";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

type SelectionError = "expired" | "failed";

const EXPIRED_CODES = [
  "UNAUTHENTICATED",
  "VALIDATION_FAILED",
  "NOT_FOUND",
  "MEMBERSHIP_INACTIVE",
  "AGENCY_LOCKED",
];

export default function SelectAgencyPage() {
  const t = useTranslations("Auth.selectAgency");
  const shell = useTranslations("Shell");
  const home = useTranslations("Home");
  const locale = useLocale();
  const router = useRouter();
  const { selectAgency } = useAuth();
  const [selection, setSelection] = useState<AgencySelection | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<SelectionError | null>(null);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const pending = loadSelection();
    if (!pending) {
      router.replace("/login");
      return;
    }
    setSelection(pending);

    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, [router]);

  const roleLabel = (role: string) => {
    const key = `roles.${role}`;
    try {
      return shell(key as never);
    } catch {
      return role;
    }
  };

  const failAndReturn = (reason: SelectionError) => {
    clearSelection();
    setBusyId(null);
    setError(reason);
    redirectTimer.current = setTimeout(() => router.replace("/login"), 2500);
  };

  const handleSelect = async (membership: AgencyMembership) => {
    if (!selection || busyId !== null || error) return;
    setBusyId(membership.id);
    const result = await selectAgency(
      selection.selection_token,
      membership.id
    );

    if (!result) {
      router.replace("/dashboard");
      return;
    }

    failAndReturn(
      EXPIRED_CODES.includes(result.code) ? "expired" : "failed"
    );
  };

  if (!selection) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-4 md:px-10">
        <Link
          href="/"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← {t("backHome")}
        </Link>
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            href="/select-agency"
            locale="en"
            className={
              locale === "en"
                ? "font-semibold text-foreground"
                : "hover:text-foreground"
            }
          >
            English
          </Link>
          <span aria-hidden="true">·</span>
          <Link
            href="/select-agency"
            locale="vi"
            className={
              locale === "vi"
                ? "font-semibold text-foreground"
                : "hover:text-foreground"
            }
          >
            Tiếng Việt
          </Link>
        </span>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-6">
        <div className="w-full max-w-[392px] rounded-2xl border border-border bg-card px-8 py-9 shadow-[0_20px_50px_rgba(23,18,46,0.07)]">
          <div className="mb-7 text-center">
            <Logo variant="violet" className="mx-auto h-11 w-11" />
            <h1 className="mt-5 text-[21px] font-extrabold tracking-tight">
              {t("heading")}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {t("subtitle")}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              <p>{t(`errors.${error}`)}</p>
              <Link
                href="/login"
                className="mt-2 inline-block font-semibold underline"
              >
                {t("backToLogin")}
              </Link>
            </div>
          )}

          <div className="flex flex-col gap-2" aria-label={t("choicesLabel")}>
            {selection.memberships.map((membership) => (
              <button
                key={membership.id}
                type="button"
                disabled={busyId !== null || !!error}
                onClick={() => handleSelect(membership)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-left transition-colors hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {membership.agency.name}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {membership.roles.map((role) => (
                      <span
                        key={role}
                        className="max-w-full truncate whitespace-nowrap rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {roleLabel(role)}
                      </span>
                    ))}
                  </span>
                  {busyId === membership.id && (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {t("opening")}
                    </span>
                  )}
                </span>
                <Icon name="chevron-left" className="h-4 w-4 shrink-0 -rotate-90 text-muted-foreground" />
              </button>
            ))}
          </div>

          <p className="mt-6 border-t border-border pt-5 text-center text-sm text-muted-foreground">
            <Link
              href="/login"
              className="border-b border-border pb-0.5 font-semibold text-foreground transition-colors hover:border-primary hover:text-primary-text"
            >
              {t("backToLogin")}
            </Link>
          </p>
        </div>
      </main>

      <footer className="px-6 py-4 text-center text-xs text-muted-foreground md:px-10">
        © 2026 {shell("brand")} · {home("footerNote")}
      </footer>
    </div>
  );
}
