"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/shell/Icon";
import { listTeams, createTeam, deleteTeam } from "@/lib/team/api";
import type { Team } from "@/lib/team/types";

export default function TeamsPage() {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations("Teams");
  const c = useTranslations("Common");

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", lead_id: "" });

  useEffect(() => {
    if (!isLoading && !session) router.replace("/login");
  }, [isLoading, session, router]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setTeams(await listTeams());
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) load();
  }, [session]);

  const canCreate = !!session?.user.permissions.includes("teams.create");
  const canDelete = !!session?.user.permissions.includes("teams.delete");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createTeam({
        name: form.name,
        description: form.description || null,
        lead_id: form.lead_id ? Number(form.lead_id) : null,
      });
      setShowCreate(false);
      setForm({ name: "", description: "", lead_id: "" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.createFailed"));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete team?")) return;
    try {
      await deleteTeam(id);
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
          <p className="text-sm text-muted-foreground">{t("teams")}</p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            {t("newTeam")}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="min-h-[320px]">
        {loading ? (
          <p className="text-sm text-muted-foreground">{c("loading")}</p>
        ) : teams.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
            <Icon name="users" className="mb-3 h-8 w-8 text-muted-foreground" />
            <h3 className="text-base font-semibold text-foreground">{t("empty.title")}</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">{t("empty.description")}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => (
              <div key={team.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{team.name}</h3>
                    <p className="truncate text-xs text-muted-foreground">{team.description ?? "—"}</p>
                  </div>
                  <span className="whitespace-nowrap rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                    {team.members_count ?? 0} {t("fields.membersCount")}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("fields.lead")}: {team.lead?.name ?? "—"}
                </div>
                <div className="mt-auto flex gap-2">
                  <button
                    type="button"
                    onClick={() => router.push(`/team/teams/${team.id}`)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                  >
                    {t("actions.edit")}
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => handleDelete(team.id)}
                      className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      {t("actions.delete")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={handleCreate} className="w-full max-w-lg space-y-4 rounded-lg bg-background p-6 shadow-xl">
            <h2 className="text-lg font-semibold">{t("newTeam")}</h2>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("fields.teamName")}</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("fields.description")}</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("fields.lead")}</label>
              <input
                type="number"
                value={form.lead_id}
                onChange={(e) => setForm({ ...form, lead_id: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-md border border-border px-4 py-2 text-sm">
                {t("actions.cancel")}
              </button>
              <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                {t("actions.create")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}