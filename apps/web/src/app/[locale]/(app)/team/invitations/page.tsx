"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/shell/Icon";
import {
  listInvitations,
  createInvitation,
  resendInvitation,
  revokeInvitation,
  listUsers,
} from "@/lib/team/api";
import type { Invitation, RoleOption } from "@/lib/team/types";

export default function InvitationsPage() {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations("Teams");
  const c = useTranslations("Common");

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", roleIds: [] as number[] });
  const [formError, setFormError] = useState<string | null>(null);

  const isOwner = !!session?.user.roles.includes("agency_owner");
  const isAdmin = !!session?.user.roles.includes("admin") && !isOwner;

  useEffect(() => {
    if (!isLoading && !session) router.replace("/login");
  }, [isLoading, session, router]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [inv, users] = await Promise.all([listInvitations(), listUsers()]);
      setInvitations(inv);
      const map = new Map<number, RoleOption>();
      users.forEach((u) => {
        u.roles.forEach((r) => {
          if (!map.has(r.id)) map.set(r.id, { id: r.id, key: r.key, name: r.name });
        });
      });
      setRoles(Array.from(map.values()));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) load();
  }, [session]);

  const canManage = !!session?.user.permissions.includes("invitations.manage");

  const visibleRoles = roles.filter((r) => {
    if (r.key === "agency_owner") return false;
    if (isAdmin && r.key === "admin") return false;
    return true;
  });

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim()) {
      setFormError(t("invitationsForm.validation.emailRequired"));
      return;
    }
    if (form.roleIds.length === 0) {
      setFormError(t("invitationsForm.validation.roleRequired"));
      return;
    }
    setFormError(null);
    try {
      await createInvitation({ email: form.email, role_ids: form.roleIds });
      setShowForm(false);
      setForm({ email: "", roleIds: [] });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.createFailed"));
    }
  };

  const handleResend = async (id: number) => {
    try {
      await resendInvitation(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.updateFailed"));
    }
  };

  const handleRevoke = async (id: number) => {
    if (!confirm(t("confirmRevokeInvitation"))) return;
    try {
      await revokeInvitation(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.deleteFailed"));
    }
  };

  if (isLoading || !session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">{c("loading")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("invitations")}</p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Icon name="user-plus" className="h-4 w-4" />
            {t("invite")}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="min-h-[320px]">
        {loading ? (
          <p className="text-sm text-muted-foreground">{c("loading")}</p>
        ) : invitations.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
            <Icon name="users" className="mb-3 h-8 w-8 text-muted-foreground" />
            <h3 className="text-base font-semibold text-foreground">{t("empty.title")}</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">{t("empty.description")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
                <div className="min-w-0">
                  <p className="font-medium">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {inv.roles.map((r) => t(`roles.${r.key}`)).join(", ")} · {inv.expires_at?.slice(0, 10)}
                  </p>
                </div>
                {canManage && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => handleResend(inv.id)} className="rounded-md border border-border px-3 py-1.5 text-xs">
                      {t("actions.resend")}
                    </button>
                    <button type="button" onClick={() => handleRevoke(inv.id)} className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600">
                      {t("actions.revoke")}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={handleInvite} className="w-full max-w-lg space-y-4 rounded-lg bg-background p-6 shadow-xl">
            <h2 className="text-lg font-semibold">{t("invite")}</h2>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("invitationsForm.email")} <span className="text-red-500" aria-hidden="true">*</span></label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("invitationsForm.roles")} <span className="text-red-500" aria-hidden="true">*</span></label>
              <div className="flex flex-wrap gap-3">
                {visibleRoles.map((r) => (
                  <label key={r.id} className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.roleIds.includes(r.id)}
                      onChange={(e) => {
                        if (e.target.checked) setForm({ ...form, roleIds: [...form.roleIds, r.id] });
                        else setForm({ ...form, roleIds: form.roleIds.filter((x) => x !== r.id) });
                      }}
                    />
                    {t(`roles.${r.key}`)}
                  </label>
                ))}
              </div>
            </div>
            {formError && (
              <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="rounded-md border border-border px-4 py-2 text-sm">
                {t("actions.cancel")}
              </button>
              <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                {t("invitationsForm.send")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}