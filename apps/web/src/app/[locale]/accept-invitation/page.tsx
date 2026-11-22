"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Link, useRouter as useI18nRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { acceptInvitation } from "@/lib/team/api";

function AcceptInvitationInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const t = useTranslations("Teams");
  const c = useTranslations("Common");
  const router = useI18nRouter();

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await acceptInvitation({ token, name, password });
      setSuccess(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("accept.errors.INVALID");
      // map known messages? rely on backend message; also try code-like mapping
      if (msg.includes("INVITATION_EXPIRED")) setError(t("accept.errors.INVITATION_EXPIRED"));
      else if (msg.includes("INVITATION_ALREADY_ACCEPTED")) setError(t("accept.errors.INVITATION_ALREADY_ACCEPTED"));
      else if (msg.includes("EMAIL_ALREADY_REGISTERED")) setError(t("accept.errors.EMAIL_ALREADY_REGISTERED"));
      else setError(msg || t("accept.errors.INVALID"));
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-6 text-center shadow-sm">
          <h1 className="text-xl font-bold">{t("accept.success")}</h1>
          <Link href="/login" className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            {t("accept.goToLogin")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-bold">{t("accept.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("accept.subtitle")}</p>
        </div>
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("accept.name")}</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("accept.password")}</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !token}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {submitting ? c("loading") : t("accept.submit")}
        </button>
      </form>
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