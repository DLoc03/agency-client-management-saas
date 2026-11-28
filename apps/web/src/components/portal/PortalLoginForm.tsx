/**
 * PortalLoginForm — FE-003
 * Calls POST /api/v1/portal/auth/login (mocked per AUTH_CONTRACT.md §3)
 * Distinct styling for Client Portal (emerald branding)
 */

"use client";
import { Icon } from "@/components/shell/Icon";

import { Link, useRouter } from "@/i18n/routing";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { usePortalAuth } from "@/lib/portal-auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

type ErrorCode =
  | "INVALID_CREDENTIALS"
  | "AGENCY_LOCKED"
  | "ACCOUNT_DISABLED"
  | "UNKNOWN";

function buildSchema(t: ReturnType<typeof useTranslations<"Portal.login">>) {
  return z.object({
    email: z
      .string()
      .min(1, t("errors.emailRequired"))
      .email(t("errors.emailInvalid")),
    password: z
      .string()
      .min(1, t("errors.passwordRequired"))
      .min(8, t("errors.passwordMinLength")),
  });
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

export function PortalLoginForm({ redirectTo }: { redirectTo?: string } = {}) {
  const t = useTranslations("Portal.login");
  const tAuth = useTranslations("Auth");
  const schema = buildSchema(t);
  const { login } = usePortalAuth();
  const router = useRouter();
  const safeRedirect =
    redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
      ? redirectTo
      : null;
  const [serverError, setServerError] = useState<ErrorCode | null>(null);
  const [invitationAgency, setInvitationAgency] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    setInvitationAgency(null);
    const trimmed = { email: values.email.trim(), password: values.password.trim() };
    const result = await login(trimmed);

    if (result.success) {
      if ("invitationOnly" in result) {
        // FIX-024: credentials are valid and a client invitation is
        // pending. Back on the accept page the flow can complete;
        // without one, point the user at the invitation email instead
        // of an error.
        if (safeRedirect) router.replace(safeRedirect);
        else setInvitationAgency(result.invitation.agency.name);
        return;
      }
      router.replace(safeRedirect || "/portal");
      return;
    }

    const knownCodes: ErrorCode[] = [
      "INVALID_CREDENTIALS",
      "AGENCY_LOCKED",
      "ACCOUNT_DISABLED",
    ];

    setServerError(
      knownCodes.includes(result.code as ErrorCode)
        ? (result.code as ErrorCode)
        : "UNKNOWN"
    );
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-5"
      aria-label={t("title")}
    >
      {/* Pending-invitation notice (FIX-024) — informational, not an error */}
      {invitationAgency && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          <p className="font-medium">{tAuth("invitationPendingTitle")}</p>
          <p>{tAuth("invitationPendingBody", { agency: invitationAgency })}</p>
        </div>
      )}

      {/* Server-level error banner */}
      {serverError && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {t(`errors.${serverError}`)}
        </div>
      )}

      {/* Email field */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="portal-email"
          className="text-sm font-medium text-neutral-700"
        >
          {t("emailLabel")}
        </label>
        <input
          id="portal-email"
          type="email"
          autoComplete="email"
          placeholder={t("emailPlaceholder")}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "portal-email-error" : undefined}
          className={[
            "rounded-lg border px-3.5 py-2.5 text-sm shadow-sm outline-none transition",
            "placeholder:text-neutral-400 focus:ring-2",
            errors.email
              ? "border-red-400 focus:ring-red-300"
              : "border-neutral-300 focus:border-emerald-500 focus:ring-emerald-200",
          ].join(" ")}
          {...register("email")}
        />
        {errors.email && (
          <p id="portal-email-error" role="alert" className="text-xs text-red-600">
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Password field */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="portal-password"
            className="text-sm font-medium text-neutral-700"
          >
            {t("passwordLabel")}
          </label>
          <Link
            href="/portal/forgot-password"
            className="text-xs text-emerald-600 hover:underline focus:outline-none focus-visible:underline"
          >
            {t("forgotPassword")}
          </Link>
        </div>
        <PasswordInput
          id="portal-password"
          autoComplete="current-password"
          placeholder={t("passwordPlaceholder")}
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "portal-password-error" : undefined}
          className={[
            "rounded-lg border px-3.5 py-2.5 text-sm shadow-sm outline-none transition",
            "placeholder:text-neutral-400 focus:ring-2",
            errors.password
              ? "border-red-400 focus:ring-red-300"
              : "border-neutral-300 focus:border-emerald-500 focus:ring-emerald-200",
          ].join(" ")}
          {...register("password")}
        />
        {errors.password && (
          <p
            id="portal-password-error"
            role="alert"
            className="text-xs text-red-600"
          >
            {errors.password.message}
          </p>
        )}
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className={[
          "inline-flex items-center justify-center gap-2",
          "mt-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2",
          isSubmitting
            ? "cursor-not-allowed bg-emerald-400"
            : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800",
        ].join(" ")}
      ><Icon name="arrow-right" className="h-4 w-4" /> 
        {isSubmitting ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
