"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useRouter as useI18nRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/shell/Icon";
import {
  getUser,
  updateUser,
  updateUserRoles,
  updateUserActivation,
  listUsers,
} from "@/lib/team/api";
import type { DirectoryUser, RoleOption } from "@/lib/team/types";

export default function MemberDetailPage() {
  const params = useParams();
  const id = Number(params?.id);
  const { session, isLoading } = useAuth();
  const router = useI18nRouter();
  const t = useTranslations("Teams");
  const c = useTranslations("Common");

  const [user, setUser] = useState<DirectoryUser | null>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ name: "", job_title: "", phone: "", locale: "en" });
  const [selectedRoles, setSelectedRoles] = useState<number[]>([]);

  const isOwner = !!session?.user.roles.includes("agency_owner");
  const isAdmin = !!session?.user.roles.includes("admin") && !isOwner;

  useEffect(() => {
    if (!isLoading && !session) router.replace("/login");
  }, [isLoading, session, router]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [u, users] = await Promise.all([getUser(id), listUsers()]);
      setUser(u);
      setForm({
        name: u.name,
        job_title: u.job_title ?? "",
        phone: u.phone ?? "",
        locale: u.locale,
      });
      setSelectedRoles(u.roles.map((r) => r.id));
      // distinct roles
      const map = new Map<number, RoleOption>();
      users.forEach((usr) => {
        usr.roles.forEach((r) => {
          if (!map.has(r.id)) map.set(r.id, { id: r.id, key: r.key, name: r.name });
        });
      });
      // also include current user roles? covered by users list
      setRoles(Array.from(map.values()));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session && id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, id]);

  const canUpdateProfile = !!session?.user.permissions.includes("users.update");
  const canManageRoles = !!session?.user.permissions.includes("users.roles.manage");
  const canActivate = !!session?.user.permissions.includes("users.activation");

  // admin limit: admin cannot manage admin roles/accounts unless owner
  const targetIsAdmin = !!user?.roles.some((r) => r.key === "admin");
  const adminLimited = isAdmin && (targetIsAdmin || selectedRoles.some((rid) => roles.find((r) => r.id === rid)?.key === "admin"));

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateUser(id, {
        name: form.name,
        job_title: form.job_title || null,
        phone: form.phone || null,
        locale: form.locale,
      });
      setUser(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.updateFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRoles = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminLimited) return;
    setSaving(true);
    try {
      const updated = await updateUserRoles(id, selectedRoles);
      setUser(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.updateFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleActivation = async (isActive: boolean) => {
    if (isAdmin && targetIsAdmin) return;
    setSaving(true);
    try {
      const updated = await updateUserActivation(id, isActive);
      setUser(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.updateFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">{c("loading")}</p>
      </div>
    );
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">{c("loading")}</p>
      </div>
    );
  }

  const visibleRoles = roles.filter((r) => {
    if (isAdmin && r.key === "admin") return false;
    if (r.key === "agency_owner") return false; // never grant owner
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => router.push("/team/members")} className="rounded-md border border-border px-3 py-1.5 text-sm">
          {t("actions.back")}
        </button>
        <h1 className="text-2xl font-bold tracking-tight">{user.name}</h1>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">{t("membersDetail.title")}</h2>
        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">{t("fields.email")}</p>
            <p className="font-medium">{user.email}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("membersDetail.openTasks")}</p>
            <p className="font-medium">{user.open_tasks_count ?? 0}</p>
          </div>
        </div>
        <div className="mb-4">
          <p className="text-xs text-muted-foreground">{t("fields.teams")}</p>
          <p className="font-medium">
            {user.teams.length ? user.teams.map((tm) => tm.name).join(", ") : t("membersDetail.noTeams")}
          </p>
        </div>
        <div className="mb-4">
          <p className="text-xs text-muted-foreground">{t("fields.roles")}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {user.roles.length === 0 ? (
              <span className="text-sm text-muted-foreground">{t("membersDetail.noRoles")}</span>
            ) : (
              user.roles.map((r) => (
                <span key={r.key} className="whitespace-nowrap rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                  {t(`roles.${r.key}`)}
                </span>
              ))
            )}
          </div>
        </div>
      </section>

      {canUpdateProfile && (
        <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">{t("actions.edit")}</h2>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("fields.name")}</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("fields.jobTitle")}</label>
                <input
                  value={form.job_title}
                  onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("fields.phone")}</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
                {saving ? c("loading") : t("actions.save")}
              </button>
            </div>
          </form>
        </section>
      )}

      {canManageRoles && (
        <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">{t("actions.changeRoles")}</h2>
          {adminLimited && (
            <p className="mb-2 text-sm text-amber-700">Admin cannot manage Admin roles.</p>
          )}
          <form onSubmit={handleSaveRoles} className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {visibleRoles.map((r) => (
                <label key={r.id} className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(r.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedRoles((prev) => [...prev, r.id]);
                      else setSelectedRoles((prev) => prev.filter((x) => x !== r.id));
                    }}
                    disabled={adminLimited}
                  />
                  {t(`roles.${r.key}`)}
                </label>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving || adminLimited}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {saving ? c("loading") : t("actions.save")}
              </button>
            </div>
          </form>
        </section>
      )}

      {canActivate && !(isAdmin && targetIsAdmin) && (
        <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">{t("fields.status")}</h2>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={user.is_active || saving}
              onClick={() => handleActivation(true)}
              className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-60"
            >
              {t("actions.activate")}
            </button>
            <button
              type="button"
              disabled={!user.is_active || saving}
              onClick={() => handleActivation(false)}
              className="rounded-md border border-red-200 px-4 py-2 text-sm text-red-600 disabled:opacity-60"
            >
              {t("actions.deactivate")}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}