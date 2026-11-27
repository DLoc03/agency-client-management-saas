/**
 * PortalForgotPasswordForm — FE-003
 * Calls POST /api/v1/portal/auth/forgot-password (mocked)
 * Always displays success confirmation to prevent account enumeration.
 */

"use client";
import { Icon } from "@/components/shell/Icon";

import { Link } from "@/i18n/routing";
import { usePortalAuth } from "@/lib/portal-auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

function buildSchema(t: ReturnType<typeof useTranslations<"Portal.forgotPassword">>) {
  return z.object({
    email: z
      .string()
      .min(1, t("errors.emailRequired"))
      .email(t("errors.emailInvalid")),
  });
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

export function PortalForgotPasswordForm() {
  const t = useTranslations("Portal.forgotPassword");
  const schema = buildSchema(t);
  const { forgotPassword } = usePortalAuth();
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormValues) => {
    await forgotPassword(values);
    setSubmitted(true);
  };

  if (submitted) {
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
          className="text-center text-sm font-medium text-emerald-600 hover:underline"
        >
          ← {t("backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-5"
      aria-label={t("title")}
    >
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="forgot-email"
          className="text-sm font-medium text-neutral-700"
        >
          {t("emailLabel")}
        </label>
        <input
          id="forgot-email"
          type="email"
          autoComplete="email"
          placeholder={t("emailPlaceholder")}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "forgot-email-error" : undefined}
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
          <p id="forgot-email-error" role="alert" className="text-xs text-red-600">
            {errors.email.message}
          </p>
        )}
      </div>

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
      ><Icon name="mail" className="h-4 w-4" /> 
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
