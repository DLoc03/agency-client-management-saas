"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/shell/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { Select } from "@/components/ui/Select";
import { listUsers, listTeams } from "@/lib/team/api";
import type { DirectoryUser } from "@/lib/team/types";

const ROLE_KEYS = ["agency_owner", "admin", "sales_manager", "project_manager", "team_member", "accountant"];

export default function MembersPage() {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations("Teams");
  const c = useTranslations("Common");

  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [teams, setTeams] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [teamId, setTeamId] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!isLoading && !session) router.replace("/login");
  }, [isLoading, session, router]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [u, tm] = await Promise.all([
        listUsers({
          q: q || undefined,
          role: role || undefined,
          team_id: teamId ? Number(teamId) : undefined,
          is_active: status === "" ? undefined : status === "active",
        }),
        listTeams(),
      ]);
      setUsers(u);
      setTeams(tm.map((x) => ({ id: x.id, name: x.name })));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, q, role, teamId, status]);

  const canManage = !!session?.user.permissions.includes("users.update");

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
          <p className="text-sm text-muted-foreground">{t("members")}</p>
        </div>
        {session.user.permissions.includes("invitations.manage") && (
          <button
            type="button"
            onClick={() => router.push("/team/invitations")}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Icon name="user-plus" className="h-4 w-4" />
            {t("invite")}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder={t("filters.search")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-[180px] flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <Select
          value={role}
          onValueChange={setRole}
          options={[
            { value: "", label: `${t("filters.all")} ${t("filters.role")}` },
            ...ROLE_KEYS.map((r) => ({ value: r, label: t(`roles.${r}`) })),
          ]}
          className="w-[190px] max-w-full"
        />
        <Select
          value={teamId}
          onValueChange={setTeamId}
          options={[
            { value: "", label: `${t("filters.all")} ${t("filters.team")}` },
            ...teams.map((tm) => ({ value: String(tm.id), label: tm.name })),
          ]}
          className="w-[190px] max-w-full"
        />
        <Select
          value={status}
          onValueChange={setStatus}
          options={[
            { value: "", label: `${t("filters.all")} ${t("filters.status")}` },
            { value: "active", label: t("filters.active") },
            { value: "inactive", label: t("filters.inactive") },
          ]}
          className="w-[190px] max-w-full"
        />
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="min-h-[320px]">
        {loading ? (
          <p className="text-sm text-muted-foreground">{c("loading")}</p>
        ) : users.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
            <Icon name="users" className="mb-3 h-8 w-8 text-muted-foreground" />
            <h3 className="text-base font-semibold text-foreground">{t("empty.title")}</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">{t("empty.description")}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {users.map((u) => (
              <div key={u.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <Avatar name={u.name} seed={u.id} className="h-10 w-10 text-sm" />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold">{u.name}</h3>
                    <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                    {u.job_title && <p className="truncate text-xs text-muted-foreground">{u.job_title}</p>}
                  </div>
                  <div className="flex shrink-0 items-start gap-1">
                    <span
                      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}
                    >
                      {u.is_active ? t("filters.active") : t("filters.inactive")}
                    </span>
                    <ActionMenu
                      items={[
                        {
                          label: t("actions.detail"),
                          icon: "eye",
                          onClick: () => router.push(`/team/members/${u.id}`),
                        },
                      ]}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {u.roles.map((r) => (
                    <span key={r.key} className="whitespace-nowrap rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                      {t(`roles.${r.key}`)}
                    </span>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground">
                  {u.teams.length ? u.teams.map((tm) => tm.name).join(", ") : t("membersDetail.noTeams")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}