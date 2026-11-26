"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { Logo } from "@/components/shell/Logo";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Skeleton, useDelayedSkeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/lib/auth";
import { acceptInvitation, previewInvitation } from "@/lib/team/api";
import type { InvitationPreview } from "@/lib/team/types";

const KNOWN_ERRORS = [
  "NOT_FOUND",
  "INVALID",
  "INVITATION_EXPIRED",
  "INVITATION_ALREADY_ACCEPTED",
  "INVITATION_LOGIN_REQUIRED",
  "INVITATION_IDENTITY_MISMATCH",
  "EMAIL_ALREADY_REGISTERED",
  "ALREADY_MEMBER",
  "STAFF_CLIENT_MEMBERSHIP_CONFLICT",
];

function errorCode(err: unknown) {
  const code = (err as { code?: string } | null)?.code;
  return code && KNOWN_ERRORS.includes(code) ? code : "INVALID";
}

function AcceptInvitationInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const t = useTranslations("Teams");
  const shell = useTranslations("Shell");
  const locale = useLocale();
  const router = useRouter();
  const { login, session } = useAuth();

  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const showSkeleton = useDelayedSkeleton(loading);

  useEffect(() => {
    let active = true;
    if (!token) {
      setPreviewError("NOT_FOUND");
      setLoading(false);
      return () => {
        active = false;
      };
    }
    setLoading(true);
    previewInvitation(token)
      .then((result) => {
        if (!active) return;
        setPreview(result);
        setPreviewError(null);
      })
      .catch((err) => {
        if (active) setPreviewError(errorCode(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(locale);
  const roleLabel = (key: string) => {
    try {
      return shell(`roles.${key}`);
    } catch {
      return key;
    }
  };
  const loginHref = `/login?returnTo=${encodeURIComponent(`/accept-invitation?token=${token}`)}`;

  const doAccept = async (withPassword: boolean) => {
    if (!preview) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await acceptInvitation({
        token,
        ...(withPassword ? { name, password } : {}),
      });
      if (withPassword) {
        const result = await login({ email: preview.email, password });
        if (result.success) {
          router.replace(result.requiresSelection ? "/select-agency" : "/dashboard");
          return;
        }
      } else {
        router.replace("/dashboard");
        return;
      }
      setAccepted(true);
    } catch (err) {
      const code = errorCode(err);
      if (code === "INVITATION_LOGIN_REQUIRED") {
        setPreview({ ...preview, has_identity: true, matches_current_user: null });
      } else if (code === "INVITATION_IDENTITY_MISMATCH") {
        setPreview({ ...preview, matches_current_user: false });
      } else {
        setActionError(t(`accept.errors.${code}`));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const info = preview ? (
    <div className="space-y-1 rounded-lg border border-border bg-background/60 p-3 text-xs text-muted-foreground">
      <p>
        <span className="font-medium text-foreground">{t("accept.preview.agency")}:</span>{" "}
        {preview.agency.name}
      </p>
      <p>
        <span className="font-medium text-foreground">{t("accept.preview.email")}:</span>{" "}
        {preview.email}
      </p>
      <p>
        <span className="font-medium text-foreground">{t("accept.preview.expires")}:</span>{" "}
        {fmtDate(preview.expires_at)}
      </p>
      <div className="flex flex-wrap gap-1 pt-1">
        <span className="whitespace-nowrap rounded-full border border-border px-2 py-0.5">
          {preview.kind === "staff"
            ? t("accept.preview.kindStaff")
            : t("accept.preview.kindClient")}
        </span>
        {preview.kind === "staff" &&
          preview.roles.map((role) => (
            <span
              key={role}
              className="whitespace-nowrap rounded-full border border-border px-2 py-0.5"
            >
              {roleLabel(role)}
            </span>
          ))}
      </div>
    </div>
  ) : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="text-center">
          <Logo variant="violet" className="mx-auto h-11 w-11" />
          <h1 className="mt-4 text-xl font-bold">{t("accept.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("accept.subtitle")}</p>
        </div>

        {showSkeleton ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <>
            {previewError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {t(`accept.errors.${previewError}`)}
              </div>
            )}
            {actionError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {actionError}
              </div>
            )}
            {info}

            {accepted && (
              <div className="space-y-3 text-center">
                <p className="text-sm font-medium">{t("accept.success")}</p>
                <Link
                  href="/dashboard"
                  className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                >
                  {t("accept.goToDashboard")}
                </Link>
              </div>
            )}

            {!previewError && !accepted && preview?.has_identity === false && (
              <form onSubmit={(e) => { e.preventDefault(); void doAccept(true); }} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="accept-name" className="text-sm font-medium">
                    {t("accept.name")}
                  </label>
                  <input
                    id="accept-name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="accept-password" className="text-sm font-medium">
                    {t("accept.password")}
                  </label>
                  <PasswordInput
                    id="accept-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
                >
                  {submitting ? t("accept.submitting") : t("accept.submit")}
                </button>
              </form>
            )}

            {!previewError && !accepted && preview?.has_identity === true && preview.matches_current_user === null && (
              <div className="space-y-3">
                <h2 className="text-base font-semibold">{t("accept.loginRequired.heading")}</h2>
                <p className="text-sm text-muted-foreground">{t("accept.loginRequired.body")}</p>
                <Link
                  href={loginHref}
                  className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                >
                  {t("accept.loginRequired.action")}
                </Link>
              </div>
            )}

            {!previewError && !accepted && preview?.matches_current_user === true && (
              <div className="space-y-3">
                <h2 className="text-base font-semibold">{t("accept.confirm.heading", { agency: preview.agency.name })}</h2>
                <p className="text-sm text-muted-foreground">
                  {t("accept.confirm.body", { email: preview.email })}
                </p>
                <button
                  type="button"
                  onClick={() => void doAccept(false)}
                  disabled={submitting}
                  className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
                >
                  {submitting ? t("accept.submitting") : t("accept.confirm.action")}
                </button>
              </div>
            )}

            {!previewError && !accepted && preview?.matches_current_user === false && (
              <div className="space-y-3">
                <h2 className="text-base font-semibold">{t("accept.mismatch.heading")}</h2>
                <p className="text-sm text-muted-foreground">
                  {t("accept.mismatch.body", {
                    email: session?.user.email ?? t("accept.mismatch.unknownEmail"),
                    invitedEmail: preview.email,
                  })}
                </p>
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {t("accept.errors.INVITATION_IDENTITY_MISMATCH")}
                </div>
                <Link href="/" className="text-sm font-medium hover:underline">
                  {t("accept.goToLogin")}
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={null}>
      <AcceptInvitationInner />
    </Suspense>
  );
}
