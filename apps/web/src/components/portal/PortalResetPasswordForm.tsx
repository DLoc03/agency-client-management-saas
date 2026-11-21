/**
 * PortalResetPasswordForm — FE-003
 * Calls POST /api/v1/portal/auth/reset-password (mocked)
 * Token is passed via URL query param or entered manually.
 */

"use client";

import { Link } from "@/i18n/routing";
import { usePortalAuth } from "@/lib/portal-auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

function buildSchema(t: ReturnType<typeof useTranslations<"Portal.resetPassword">>) {
  return z.object({
    token: z.string().min(1, t("errors.tokenRequired")),
    email: z.string().email(),
    password: z
      .string()
      .min(1, t("errors.passwordRequired"))
      .min(8, t("errors.passwordMinLength")),
  });
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

interface Props {
  initialToken?: string;
  initialEmail?: string;
}

export function PortalResetPasswordForm({
  initialToken = "",
  initialEmail = "",
}: Props) {
  const t = useTranslations("Portal.resetPassword");
  const schema = buildSchema(t);
  const { resetPassword } = usePortalAuth();
  const [success, setSuccess] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      token: initialToken,
      email: initialEmail,
    },
  });

  const onSubmit = async (values: FormValues) => {
    setErrorBanner(null);
    const result = await resetPassword(values);

    if (result.success) {
      setSuccess(true);
    } else {
      setErrorBanner(
        result.code === "INVALID_RESET_TOKEN"
          ? t("errors.INVALID_RESET_TOKEN")
          : result.message || "Reset failed."
      );
    }
  };

  if (success) {
    return (
      <div className="flex flex-col gap-6">
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-800"
        >
          {t("successNotice")}
        </div>
        <Link
          href="/portal/login"
          className="text-center text-sm font-semibold text-emerald-600 hover:underline"
        >
          {t("backToLogin")} →
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-4"
      aria-label={t("title")}
    >
      {errorBanner && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {errorBanner}
        </div>
      )}

      {/* Token field */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="reset-token"
          className="text-sm font-medium text-neutral-700"
        >
          {t("tokenLabel")}
        </label>
        <input
          id="reset-token"
          type="text"
          placeholder={t("tokenPlaceholder")}
          aria-invalid={!!errors.token}
          className="rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
          {...register("token")}
        />
        {errors.token && (
          <p role="alert" className="text-xs text-red-600">
            {errors.token.message}
          </p>
        )}
      </div>

      {/* Hidden/readonly email */}
      <input type="hidden" {...register("email")} />

      {/* New Password field */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="new-password"
          className="text-sm font-medium text-neutral-700"
        >
          {t("passwordLabel")}
        </label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          placeholder={t("passwordPlaceholder")}
          aria-invalid={!!errors.password}
          className="rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
          {...register("password")}
        />
        {errors.password && (
          <p role="alert" className="text-xs text-red-600">
            {errors.password.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className={[
          "mt-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2",
          isSubmitting
            ? "cursor-not-allowed bg-emerald-400"
            : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800",
        ].join(" ")}
      >
        {isSubmitting ? t("submitting") : t("submit")}
      </button>

      <div className="mt-2 text-center">
        <Link
          href="/portal/login"
          className="text-xs text-neutral-500 hover:text-neutral-800 hover:underline"
        >
          ← {t("backToLogin")}
        </Link>
      </div>
    </form>
  );
}
