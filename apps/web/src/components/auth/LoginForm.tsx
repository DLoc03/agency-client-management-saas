/**
 * LoginForm — FE-002
 * Calls POST /api/v1/auth/login (mocked) per AUTH_CONTRACT.md §3.
 * No hardcoded display strings — all from next-intl.
 */

"use client";

import { useRouter } from "@/i18n/routing";
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
  | "UNKNOWN";

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

export function LoginForm() {
  const t = useTranslations("Auth.login");
  const schema = buildSchema(t);
  const { login } = useAuth();
  const router = useRouter();
  const [serverError, setServerError] = useState<ErrorCode | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const errorCode = await login(values);

    if (!errorCode) {
      router.replace("/dashboard");
      return;
    }

    const knownCodes: ErrorCode[] = [
      "INVALID_CREDENTIALS",
      "AGENCY_LOCKED",
      "ACCOUNT_DISABLED",
    ];
    setServerError(
      knownCodes.includes(errorCode as ErrorCode)
        ? (errorCode as ErrorCode)
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
          htmlFor="email"
          className="text-sm font-medium text-neutral-700"
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
            "placeholder:text-neutral-400 focus:ring-2",
            errors.email
              ? "border-red-400 focus:ring-red-300"
              : "border-neutral-300 focus:border-indigo-500 focus:ring-indigo-200",
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
            className="text-sm font-medium text-neutral-700"
          >
            {t("passwordLabel")}
          </label>
          <a
            href="#"
            className="text-xs text-indigo-600 hover:underline focus:outline-none focus-visible:underline"
          >
            {t("forgotPassword")}
          </a>
        </div>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder={t("passwordPlaceholder")}
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "password-error" : undefined}
          className={[
            "rounded-lg border px-3.5 py-2.5 text-sm shadow-sm outline-none transition",
            "placeholder:text-neutral-400 focus:ring-2",
            errors.password
              ? "border-red-400 focus:ring-red-300"
              : "border-neutral-300 focus:border-indigo-500 focus:ring-indigo-200",
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
          "mt-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2",
          isSubmitting
            ? "cursor-not-allowed bg-indigo-400"
            : "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800",
        ].join(" ")}
      >
        {isSubmitting ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
