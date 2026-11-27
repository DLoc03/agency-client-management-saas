"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useRouter as useI18nRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Select } from "@/components/ui/Select";
import { Icon } from "@/components/shell/Icon";
import { Forbidden, isForbiddenError } from "@/components/ui/Forbidden";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { getTeam, updateTeam, deleteTeam, addTeamMember, removeTeamMember, listUsers } from "@/lib/team/api";
import type { DirectoryUser, Team } from "@/lib/team/types";

export default function TeamDetailPage() {
  const params = useParams();
  const id = Number(params?.id);
  const { session, isLoading } = useAuth();
  const router = useI18nRouter();
  const t = useTranslations("Teams");
  const confirmAction = useConfirm();
  const c = useTranslations("Common");

  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", lead_id: "" });
  const [newMemberId, setNewMemberId] = useState("");
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);

  useEffect(() => {
    if (!isLoading && !session) router.replace("/login");
  }, [isLoading, session, router]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tm, users] = await Promise.all([getTeam(id), listUsers().catch(() => [] as DirectoryUser[])]);
      setTeam(tm);
      setDirectory(users);
      setForm({
        name: tm.name,
        description: tm.description ?? "",
        lead_id: tm.lead_id ? String(tm.lead_id) : "",
      });
      setForbidden(false);
    } catch (e) {
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session && id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, id]);

  const canUpdate = !!session?.user.permissions.includes("teams.update");
  const canManageMembers = !!session?.user.permissions.includes("teams.members.manage");
  const canDelete = !!session?.user.permissions.includes("teams.delete");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await updateTeam(id, {
        name: form.name,
        description: form.description || null,
        lead_id: form.lead_id ? Number(form.lead_id) : null,
      });
      setTeam(updated);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : t("errors.updateFailed"));
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberId) return;
    try {
      const updated = await addTeamMember(id, Number(newMemberId));
      setTeam(updated);
      setNewMemberId("");
    } catch (e) {
      setMemberError(e instanceof Error ? e.message : t("errors.updateFailed"));
    }
  };

  const handleRemoveMember = async (userId: number) => {
    try {
      await removeTeamMember(id, userId);
      const updated = await getTeam(id);
      setTeam(updated);
    } catch (e) {
      setMemberError(e instanceof Error ? e.message : t("errors.deleteFailed"));
    }
  };

  if (isLoading || !session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">{c("loading")}</p>
      </div>
    );
  }

  if (loading || !team) {
    if (forbidden) return <Forbidden />;
    if (!loading && error) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      );
    }
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">{c("loading")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => router.push("/team/teams")} className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"><Icon name="chevron-left" className="h-4 w-4" /> 
          {t("actions.back")}
        </button>
        <h1 className="text-2xl font-bold tracking-tight">{team.name}</h1>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {canUpdate && (
        <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">{t("actions.edit")}</h2>
          <form onSubmit={handleSave} className="space-y-4">
            {editError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {editError}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("fields.teamName")} <span className="text-red-500" aria-hidden="true">*</span></label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("fields.lead")}</label>
                <Select
                  value={form.lead_id}
                  onValueChange={(v) => setForm({ ...form, lead_id: v })}
                  options={[
                    { value: "", label: "—" },
                    ...(team?.members ?? []).map((u) => ({ value: String(u.id), label: `${u.name} (${u.email})` })),
                  ]}
                  className="w-full"
                />
              </div>
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
            <div className="flex justify-end gap-2">
              <button type="submit" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              <Icon name="check" className="h-4 w-4" />
                {t("actions.save")}
              </button>
              {canDelete && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!(await confirmAction(t("confirmDeleteTeam"), { intent: "delete" }))) return;
                    try {
                      await deleteTeam(id);
                      router.push("/team/teams");
                    } catch (e) {
                      setError(e instanceof Error ? e.message : t("errors.deleteFailed"));
                    }
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-red-200 px-4 py-2 text-sm text-red-600"
                ><Icon name="trash-2" className="h-4 w-4" /> 
                  {t("actions.delete")}
                </button>
              )}
            </div>
          </form>
        </section>
      )}

      <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">{t("teamsDetail.members")}</h2>
        {memberError && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {memberError}
          </div>
        )}
        {canManageMembers && (
          <form onSubmit={handleAddMember} className="mb-4 flex gap-2">
            <Select
              value={newMemberId}
              onValueChange={setNewMemberId}
              options={[
                { value: "", label: t("teamsDetail.selectMember") },
                ...directory
                  .filter((u) => !(team?.members || []).some((m) => m.id === u.id))
                  .map((u) => ({ value: String(u.id), label: `${u.name} (${u.email})` })),
              ]}
              className="flex-1"
            />
            <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"><Icon name="user-plus" className="h-4 w-4" /> 
              {t("actions.add")}
            </button>
          </form>
        )}
        {(team.members || []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("teamsDetail.noMembers")}</p>
        ) : (
          <ul className="space-y-2">
            {(team.members || []).map((m) => (
              <li key={m.id} className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <p className="font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.email}</p>
                </div>
                {canManageMembers && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(m.id)}
                    className="inline-flex items-center justify-center gap-1.5 text-xs text-red-600 hover:underline"
                  ><Icon name="x" className="h-3.5 w-3.5" /> 
                    {t("actions.remove")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}