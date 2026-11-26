"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { PortalLoginForm } from "@/components/portal/PortalLoginForm";
import { Logo } from "@/components/shell/Logo";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Skeleton, useDelayedSkeleton } from "@/components/ui/Skeleton";
import { usePortalAuth } from "@/lib/portal-auth";
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
  "STAFF_CLIENT_MEMBERSHIP_CONFLICT",
];

function errorCode(err: unknown) {
  const code = (err as { code?: string } | null)?.code;
  return code && KNOWN_ERRORS.includes(code) ? code : "INVALID";
}

function PortalAcceptInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const t = useTranslations("Portal.accept");
  const loginT = useTranslations("Portal.login");
  const locale = useLocale();
  const router = useRouter();
  const { login, session } = usePortalAuth();

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
    previewInvitation(token, { portal: true })
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

  // FIX-023: a staff invitation opened on the Portal surface belongs to
  // the internal accept page — forward it, keeping the same token.
  useEffect(() => {
    if (preview && preview.kind === "staff") {
      router.replace(`/accept-invitation?token=${encodeURIComponent(token)}`);
    }
  }, [preview, token, router]);

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(locale);
  const inputCls =
    "w-full rounded-lg border border-neutral-300 bg-white/90 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-neutral-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200";

  const doAccept = async (withPassword: boolean) => {
    if (!preview) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await acceptInvitation(
        { token, ...(withPassword ? { name, password } : {}) },
        { portal: true }
      );
      if (withPassword) {
        const result = await login({ email: preview.email, password });
        if (!result.success) {
          setAccepted(true);
          return;
        }
      }
      router.replace("/portal");
    } catch (err) {
      const code = errorCode(err);
      if (code === "INVITATION_LOGIN_REQUIRED") {
        setPreview({ ...preview, has_identity: true, matches_current_user: null });
      } else if (code === "INVITATION_IDENTITY_MISMATCH") {
        setPreview({ ...preview, matches_current_user: false });
      } else {
        setActionError(t(`errors.${code}`));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const tiles = [
    { title: loginT("tileProjectsTitle"), text: loginT("tileProjectsText") },
    { title: loginT("tileTasksTitle"), text: loginT("tileTasksText") },
    { title: loginT("tileInvoicesTitle"), text: loginT("tileInvoicesText") },
  ];

  return (
    <main className="flex-1 bg-[linear-gradient(135deg,#d9f5e8_0%,#eefaf4_45%,#e3f2ec_100%)] px-4 py-10 md:py-12">
      <div className="mx-auto w-full max-w-[400px] rounded-[22px] border border-white/80 bg-white/80 p-8 shadow-[0_24px_60px_rgba(6,60,40,0.13)] backdrop-blur-md">
        <div className="mb-6 text-center">
          <Logo variant="emerald" className="mx-auto h-11 w-11" />
          <h1 className="mt-4 text-[21px] font-extrabold tracking-tight text-slate-900">
            {t("heading")}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
            {t("subtitle")}
          </p>
        </div>

        {showSkeleton ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            {previewError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {t(`errors.${previewError}`)}
              </div>
            )}
            {actionError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {actionError}
              </div>
            )}
            {preview && (
              <div className="space-y-1 rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-xs text-slate-600 backdrop-blur">
                <p>
                  <span className="font-semibold text-emerald-950">{t("agencyLabel")}:</span>{" "}
                  {preview.agency.name}
                </p>
                <p>
                  <span className="font-semibold text-emerald-950">{t("emailLabel")}:</span>{" "}
                  {preview.email}
                </p>
                <p>
                  <span className="font-semibold text-emerald-950">{t("expiresLabel")}:</span>{" "}
                  {fmtDate(preview.expires_at)}
                </p>
              </div>
            )}

            {accepted && (
              <div className="space-y-3 text-center">
                <p className="text-sm font-medium text-emerald-950">{t("success")}</p>
                <Link
                  href="/portal"
                  className="inline-flex rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  {t("goToPortal")}
                </Link>
              </div>
            )}

            {!previewError && !accepted && preview?.has_identity === false && preview?.matches_current_user === null && (
              <form
                onSubmit={(e) => { e.preventDefault(); void doAccept(true); }}
                className="flex flex-col gap-4"
              >
                <h2 className="text-base font-bold text-slate-900">{t("newEmailTitle")}</h2>
                <p className="text-sm text-slate-500">{t("newEmailSubtitle")}</p>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="portal-accept-name" className="text-sm font-medium text-neutral-700">
                    {t("name")}
                  </label>
                  <input
                    id="portal-accept-name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="portal-accept-password" className="text-sm font-medium text-neutral-700">
                    {t("password")}
                  </label>
                  <PasswordInput
                    id="portal-accept-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:bg-emerald-400"
                >
                  {submitting ? t("submitting") : t("submit")}
                </button>
              </form>
            )}

            {!previewError && !accepted && preview?.has_identity === true && preview.matches_current_user === null && (
              <div className="space-y-4">
                <h2 className="text-base font-bold text-slate-900">{t("loginRequiredTitle")}</h2>
                <p className="text-sm text-slate-500">{t("loginRequiredBody")}</p>
                <PortalLoginForm
                  redirectTo={`/portal/accept-invitation?token=${token}`}
                />
              </div>
            )}

            {!previewError && !accepted && preview?.matches_current_user === true && (
              <div className="space-y-3">
                <h2 className="text-base font-bold text-slate-900">{t("confirmTitle")}</h2>
                <p className="text-sm text-slate-500">
                  {t("confirmBody", { email: preview.email })}
                </p>
                <button
                  type="button"
                  onClick={() => void doAccept(false)}
                  disabled={submitting}
                  className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:bg-emerald-400"
                >
                  {submitting ? t("submitting") : t("confirmAction")}
                </button>
              </div>
            )}

            {!previewError && !accepted && preview?.matches_current_user === false && (
              <div className="space-y-3">
                <h2 className="text-base font-bold text-slate-900">{t("mismatchTitle")}</h2>
                <p className="text-sm text-slate-500">
                  {t("mismatchBody", {
                    email: session?.client.email ?? t("unknownEmail"),
                    invitedEmail: preview.email,
                  })}
                </p>
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {t("errors.INVITATION_IDENTITY_MISMATCH")}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div aria-hidden="true" className="mx-auto mt-4 grid w-full max-w-[400px] grid-cols-3 gap-3">
        {tiles.map((tile) => (
          <div
            key={tile.title}
            className="rounded-2xl border border-white/70 bg-white/60 px-3.5 py-3.5 backdrop-blur"
          >
            <p className="text-[15px] font-extrabold text-emerald-950">{tile.title}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{tile.text}</p>
          </div>
        ))}
      </div>
    </main>
  );
}

export default function PortalAcceptInvitationPage() {
  return (
    <Suspense fallback={null}>
      <PortalAcceptInner />
    </Suspense>
  );
}
