/**
 * LoginForm — FE-002, FE-004
 * Calls POST /api/v1/auth/login via BFF route handler per AUTH_CONTRACT.md §3.
 * Maps INVALID_CREDENTIALS, AGENCY_LOCKED, ACCOUNT_DISABLED to the error banner,
 * respecting bilingual error messages returned by the API.
 * No hardcoded display strings — all from next-intl.
 */

"use client";
import { Icon } from "@/components/shell/Icon";

import { useRouter } from "@/i18n/routing";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useAuth } from "@/lib/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

type ErrorCode =
  | "INVALID_CREDENTIALS"
  | "AGENCY_LOCKED"
  | "ACCOUNT_DISABLED"
  | "NO_ACTIVE_MEMBERSHIP"
  | "UNKNOWN";

interface FormServerError {
  code: ErrorCode;
  message?: string;
}

function buildSchema(t: ReturnType<typeof useTranslations<"Auth.login">>) {
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

export function LoginForm({ redirectTo }: { redirectTo?: string } = {}) {
  const t = useTranslations("Auth.login");
  const tAuth = useTranslations("Auth");
  const schema = buildSchema(t);
  const { login } = useAuth();
  const router = useRouter();
  const safeRedirect =
    redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
      ? redirectTo
      : null;
  const [serverError, setServerError] = useState<FormServerError | null>(null);
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
    const result = await login(values);

    if (result.success) {
      if ("invitationOnly" in result) {
        // FIX-024: credentials are valid and an invitation is pending.
        // Back on the accept page the flow can complete; without one,
        // point the user at the invitation email instead of an error.
        if (safeRedirect) router.replace(safeRedirect);
        else setInvitationAgency(result.invitation.agency.name);
        return;
      }
      if (safeRedirect) router.replace(safeRedirect);
      else router.replace(result.requiresSelection ? "/select-agency" : "/dashboard");
      return;
    }

    const knownCodes: ErrorCode[] = [
      "INVALID_CREDENTIALS",
      "AGENCY_LOCKED",
      "ACCOUNT_DISABLED",
      "NO_ACTIVE_MEMBERSHIP",
    ];

    const code = knownCodes.includes(result.code as ErrorCode)
      ? (result.code as ErrorCode)
      : "UNKNOWN";

    setServerError({
      code,
      message: code === "NO_ACTIVE_MEMBERSHIP" ? undefined : result.message,
    });
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
          className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700"
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
          {serverError.message || t(`errors.${serverError.code}`)}
        </div>
      )}

      {/* Email field */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="email"
          className="text-sm font-medium"
        >
          {t("emailLabel")}
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder={t("emailPlaceholder")}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
          className={[
            "rounded-lg border px-3.5 py-2.5 text-sm shadow-sm outline-none transition",
            "placeholder:text-muted-foreground focus:ring-2",
            errors.email
              ? "border-red-400 focus:ring-red-300"
              : "border-input bg-background focus:border-primary focus:ring-primary/25",
          ].join(" ")}
          {...register("email")}
        />
        {errors.email && (
          <p id="email-error" role="alert" className="text-xs text-red-600">
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Password field */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="password"
            className="text-sm font-medium"
          >
            {t("passwordLabel")}
          </label>
          <a
            href="#"
            className="text-xs font-medium text-primary-text hover:underline focus:outline-none focus-visible:underline"
          >
            {t("forgotPassword")}
          </a>
        </div>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          placeholder={t("passwordPlaceholder")}
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "password-error" : undefined}
          className={[
            "rounded-lg border px-3.5 py-2.5 text-sm shadow-sm outline-none transition",
            "placeholder:text-muted-foreground focus:ring-2",
            errors.password
              ? "border-red-400 focus:ring-red-300"
              : "border-input bg-background focus:border-primary focus:ring-primary/25",
          ].join(" ")}
          {...register("password")}
        />
        {errors.password && (
          <p
            id="password-error"
            role="alert"
            className="text-xs text-red-600"
          >
            {errors.password.message}
          </p>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className={[
          "inline-flex items-center justify-center gap-2",
          "mt-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          isSubmitting
            ? "cursor-not-allowed bg-primary/60"
            : "bg-primary hover:opacity-90 active:opacity-95",
        ].join(" ")}
      ><Icon name="arrow-right" className="h-4 w-4" /> 
        {isSubmitting ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
