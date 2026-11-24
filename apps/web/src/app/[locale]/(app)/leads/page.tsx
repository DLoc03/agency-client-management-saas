"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useRouter } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { Icon } from "@/components/shell/Icon";
import {
  createLead,
  getPipelineSummary,
  listDirectoryUsers,
  listDueActivities,
  listLeads,
  updateLead,
} from "@/lib/leads/api";
import type {
  DirectoryUser,
  Lead,
  LeadActivity,
  LeadSource,
  LeadStatus,
  PipelineSummaryRow,
} from "@/lib/leads/types";

const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
  "unqualified",
];
const LEAD_SOURCES: LeadSource[] = [
  "website",
  "referral",
  "social",
  "cold_outreach",
  "other",
];

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const labelCls = "mb-1 block text-sm font-medium";

export default function LeadsPage() {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("Leads");
  const c = useTranslations("Common");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [summary, setSummary] = useState<PipelineSummaryRow[]>([]);
  const [due, setDue] = useState<LeadActivity[]>([]);
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [source, setSource] = useState("");
  const [ownerId, setOwnerId] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({
    name: "",
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    source: "website",
    status: "new",
    estimated_value: "",
    owner_id: "",
    unqualified_reason: "",
  });

  const [dragLeadId, setDragLeadId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<LeadStatus | null>(null);

  useEffect(() => {
    if (!isLoading && !session) router.replace("/login");
  }, [isLoading, session, router]);

  useEffect(() => {
    listDirectoryUsers()
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, sum, dueList] = await Promise.all([
        listLeads({
          q: q || undefined,
          source: source || undefined,
          owner_id: ownerId ? Number(ownerId) : undefined,
        }),
        getPipelineSummary().catch(() => [] as PipelineSummaryRow[]),
        listDueActivities().catch(() => [] as LeadActivity[]),
      ]);
      setLeads(data);
      setSummary(sum);
      setDue(dueList);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, q, source, ownerId]);

  const canCreate = !!session?.user.permissions.includes("leads.create");
  const canUpdate = !!session?.user.permissions.includes("leads.update");
  const currency = session?.agency.base_currency || "USD";

  const fmtMoney = (v: number | string | null | undefined) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "string" ? parseFloat(v) : v;
    if (Number.isNaN(n)) return null;
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(n);
    } catch {
      return n.toLocaleString(locale);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await createLead({
        name: form.name,
        company_name: form.company_name || null,
        contact_name: form.contact_name || null,
        email: form.email || null,
        phone: form.phone || null,
        source: form.source,
        status: form.status,
        estimated_value: form.estimated_value
          ? Number(form.estimated_value)
          : null,
        owner_id: form.owner_id ? Number(form.owner_id) : null,
        unqualified_reason:
          form.status === "unqualified" ? form.unqualified_reason || null : null,
      });
      setShowCreate(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.createFailed"));
    } finally {
      setCreating(false);
    }
  };

  const moveLead = async (leadId: number, status: LeadStatus) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.status === status || lead.converted_client_id) return;
    try {
      await updateLead(leadId, { status });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.saveFailed"));
    }
  };

  const summaryFor = (status: LeadStatus) =>
    summary.find((row) => row.status === status);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Icon name="users" className="h-4 w-4" />
            {t("newLead")}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder={t("filters.search")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-[180px] flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">
            {t("filters.all")} {t("filters.source")}
          </option>
          {LEAD_SOURCES.map((s) => (
            <option key={s} value={s}>
              {t(`sources.${s}`)}
            </option>
          ))}
        </select>
        <select
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">
            {t("filters.all")} {t("filters.owner")}
          </option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showCreate && canCreate && (
        <form
          onSubmit={handleCreate}
          className="space-y-4 rounded-lg border border-border bg-card p-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>{t("fields.name")} *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{t("fields.company")}</label>
              <input
                value={form.company_name}
                onChange={(e) =>
                  setForm({ ...form, company_name: e.target.value })
                }
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{t("fields.contactName")}</label>
              <input
                value={form.contact_name}
                onChange={(e) =>
                  setForm({ ...form, contact_name: e.target.value })
                }
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{t("fields.email")}</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{t("fields.phone")}</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{t("fields.source")}</label>
              <select
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                className={inputCls}
              >
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {t(`sources.${s}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t("fields.status")}</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className={inputCls}
              >
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`statuses.${s}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t("fields.estimatedValue")}</label>
              <input
                type="number"
                min="0"
                value={form.estimated_value}
                onChange={(e) =>
                  setForm({ ...form, estimated_value: e.target.value })
                }
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{t("fields.owner")}</label>
              <select
                value={form.owner_id}
                onChange={(e) => setForm({ ...form, owner_id: e.target.value })}
                className={inputCls}
              >
                <option value="">—</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            {form.status === "unqualified" && (
              <div>
                <label className={labelCls}>
                  {t("fields.unqualifiedReason")}
                </label>
                <input
                  value={form.unqualified_reason}
                  onChange={(e) =>
                    setForm({ ...form, unqualified_reason: e.target.value })
                  }
                  className={inputCls}
                />
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={creating}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {t("actions.create")}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              {t("actions.cancel")}
            </button>
          </div>
        </form>
      )}

      {/* Due follow-ups */}
      {due.length > 0 && (
        <section className="space-y-3 rounded-lg border border-border bg-card p-5">
          <h2 className="text-base font-semibold text-foreground">
            {t("due.title")} ({due.length})
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {due.map((activity) => (
              <li
                key={activity.id}
                className="rounded-md border border-border p-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-xs">
                    {t(`activities.types.${activity.type}`)}
                  </span>
                  {activity.lead && (
                    <Link
                      href={`/leads/${activity.lead.id}`}
                      className="truncate font-medium text-foreground hover:underline"
                    >
                      {activity.lead.name}
                    </Link>
                  )}
                </div>
                {activity.note && (
                  <p className="mt-1 truncate text-muted-foreground">
                    {activity.note}
                  </p>
                )}
                {activity.scheduled_at && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(activity.scheduled_at).toLocaleString(locale)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Pipeline board */}
      <div className="min-h-[320px]">
        {loading ? (
          <p className="text-sm text-muted-foreground">{c("loading")}</p>
        ) : leads.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
            <Icon name="users" className="mb-3 h-8 w-8 text-muted-foreground" />
            <h3 className="text-base font-semibold text-foreground">
              {t("empty.title")}
            </h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {t("empty.description")}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {LEAD_STATUSES.map((status) => {
              const columnLeads = leads.filter((l) => l.status === status);
              const sum = summaryFor(status);
              return (
                <section
                  key={status}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(status);
                  }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragLeadId !== null) moveLead(dragLeadId, status);
                    setDragLeadId(null);
                    setDragOver(null);
                  }}
                  className={`flex min-h-[280px] flex-col gap-3 rounded-lg border bg-card/50 p-3 ${
                    dragOver === status
                      ? "border-primary"
                      : "border-border"
                  }`}
                >
                  <header className="flex items-center justify-between gap-2 px-1">
                    <h2 className="text-sm font-semibold text-foreground">
                      {t(`statuses.${status}`)}
                    </h2>
                    <span className="whitespace-nowrap rounded-full border border-border px-2 py-0.5 text-xs font-medium">
                      {sum ? sum.leads_count : columnLeads.length}
                    </span>
                  </header>
                  <p className="px-1 text-xs text-muted-foreground">
                    {t("board.total")}:{" "}
                    {fmtMoney(sum ? sum.total_estimated_value : 0) || "0"}
                  </p>
                  <div className="flex flex-1 flex-col gap-3">
                    {columnLeads.map((lead) => (
                      <article
                        key={lead.id}
                        draggable={canUpdate && !lead.converted_client_id}
                        onDragStart={() => setDragLeadId(lead.id)}
                        onDragEnd={() => {
                          setDragLeadId(null);
                          setDragOver(null);
                        }}
                        className="space-y-2 rounded-md border border-border bg-card p-3 shadow-sm"
                      >
                        <Link
                          href={`/leads/${lead.id}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {lead.name}
                        </Link>
                        {lead.company_name && (
                          <p className="truncate text-sm text-muted-foreground">
                            {lead.company_name}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {fmtMoney(lead.estimated_value) && (
                            <span className="font-medium text-foreground">
                              {fmtMoney(lead.estimated_value)}
                            </span>
                          )}
                          {lead.source && (
                            <span className="whitespace-nowrap rounded-full bg-accent px-2 py-0.5">
                              {t(`sources.${lead.source}`)}
                            </span>
                          )}
                          {lead.converted_client_id && (
                            <span className="whitespace-nowrap rounded-full border border-border px-2 py-0.5">
                              {t("detail.convert")}
                            </span>
                          )}
                        </div>
                        {lead.owner && (
                          <p className="truncate text-xs text-muted-foreground">
                            {t("fields.owner")}: {lead.owner.name}
                          </p>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
