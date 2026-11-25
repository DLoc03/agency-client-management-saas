"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useRouter } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { Select } from "@/components/ui/Select";
import { ActionMenu } from "@/components/ui/ActionMenu";
import {
  convertLead,
  createLeadActivity,
  createLeadContact,
  createLeadNote,
  deleteLead,
  deleteLeadActivity,
  deleteLeadContact,
  deleteLeadNote,
  getLead,
  listDirectoryUsers,
  listLeadActivities,
  listLeadNotes,
  updateLead,
  updateLeadActivity,
  updateLeadContact,
} from "@/lib/leads/api";
import { statusBadgeClass } from "@/lib/status-colors";
import { LeadApiError } from "@/lib/leads/types";
import type {
  DirectoryUser,
  Lead,
  LeadActivity,
  LeadContact,
  LeadNote,
  LeadSource,
  LeadStatus,
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
const ACTIVITY_TYPES = ["call", "message", "meeting", "other"] as const;

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const labelCls = "mb-1 block text-sm font-medium";
const cardCls = "space-y-4 rounded-lg border border-border bg-card p-5";
const sectionTitleCls = "text-base font-semibold text-foreground";

export default function LeadDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("Leads");
  const c = useTranslations("Common");

  const [lead, setLead] = useState<Lead | null>(null);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const [contactForm, setContactForm] = useState<Record<string, string>>({
    full_name: "",
    email: "",
    phone: "",
    position: "",
  });
  const [contactPrimary, setContactPrimary] = useState(false);
  const [editingContact, setEditingContact] = useState<LeadContact | null>(null);

  const [noteBody, setNoteBody] = useState("");

  const [activityForm, setActivityForm] = useState<Record<string, string>>({
    type: "call",
    scheduled_at: "",
    note: "",
  });

  const [convertManagerId, setConvertManagerId] = useState("");
  const [converting, setConverting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  useEffect(() => {
    if (!isLoading && !session) router.replace("/login");
  }, [isLoading, session, router]);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ld, ns, acts, us] = await Promise.all([
        getLead(id),
        listLeadNotes(id).catch(() => [] as LeadNote[]),
        listLeadActivities(id).catch(() => [] as LeadActivity[]),
        listDirectoryUsers().catch(() => [] as DirectoryUser[]),
      ]);
      setLead(ld);
      setNotes(ns);
      setActivities(acts);
      setUsers(us);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, id]);

  const canUpdate = !!session?.user.permissions.includes("leads.update");
  const canDelete = !!session?.user.permissions.includes("leads.delete");
  const canNotes = !!session?.user.permissions.includes("leads.notes.manage");
  const canActivities = !!session?.user.permissions.includes(
    "leads.activities.manage",
  );
  const canConvert = !!session?.user.permissions.includes("leads.convert");
  const isPrivileged =
    !!session?.user.roles.includes("agency_owner") ||
    !!session?.user.roles.includes("admin");
  const converted = !!lead?.converted_client_id;
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
  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale) : "—";
  const fmtDateTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(locale) : "—";

  const startEdit = () => {
    if (!lead) return;
    setForm({
      name: lead.name,
      company_name: lead.company_name || "",
      contact_name: lead.contact_name || "",
      email: lead.email || "",
      phone: lead.phone || "",
      source: lead.source || "website",
      status: lead.status,
      estimated_value:
        lead.estimated_value !== null && lead.estimated_value !== undefined
          ? String(lead.estimated_value)
          : "",
      owner_id: lead.owner ? String(lead.owner.id) : "",
      unqualified_reason: lead.unqualified_reason || "",
    });
    setEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateLead(id, {
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
      setEditing(false);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLead = async () => {
    if (!window.confirm(t("confirmDelete"))) return;
    try {
      await deleteLead(id);
      router.replace("/leads");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.deleteFailed"));
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      full_name: contactForm.full_name,
      email: contactForm.email || null,
      phone: contactForm.phone || null,
      position: contactForm.position || null,
      is_primary: contactPrimary,
    };
    try {
      if (editingContact) {
        await updateLeadContact(id, editingContact.id, payload);
      } else {
        await createLeadContact(id, payload);
      }
      setContactForm({ full_name: "", email: "", phone: "", position: "" });
      setContactPrimary(false);
      setEditingContact(null);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.saveFailed"));
    }
  };

  const handleDeleteContact = async (contact: LeadContact) => {
    if (!window.confirm(t("confirmDeleteContact"))) return;
    try {
      await deleteLeadContact(id, contact.id);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.deleteFailed"));
    }
  };

  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteBody.trim()) return;
    try {
      await createLeadNote(id, noteBody.trim());
      setNoteBody("");
      setNotes(await listLeadNotes(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.saveFailed"));
    }
  };

  const handleDeleteNote = async (note: LeadNote) => {
    try {
      await deleteLeadNote(id, note.id);
      setNotes(await listLeadNotes(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.deleteFailed"));
    }
  };

  const handleActivitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createLeadActivity(id, {
        type: activityForm.type,
        scheduled_at: activityForm.scheduled_at
          ? new Date(activityForm.scheduled_at).toISOString()
          : null,
        note: activityForm.note || null,
      });
      setActivityForm({ type: "call", scheduled_at: "", note: "" });
      setActivities(await listLeadActivities(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.saveFailed"));
    }
  };

  const handleToggleActivity = async (activity: LeadActivity) => {
    try {
      await updateLeadActivity(id, activity.id, {
        is_done: !activity.is_done,
      });
      setActivities(await listLeadActivities(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.saveFailed"));
    }
  };

  const handleDeleteActivity = async (activity: LeadActivity) => {
    try {
      await deleteLeadActivity(id, activity.id);
      setActivities(await listLeadActivities(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.deleteFailed"));
    }
  };

  const handleConvert = async (force: boolean) => {
    setConverting(true);
    setError(null);
    try {
      const client = await convertLead(id, {
        force,
        account_manager_id: convertManagerId
          ? Number(convertManagerId)
          : null,
      });
      setDuplicateWarning(false);
      router.push(`/clients/${client.id}`);
    } catch (e) {
      if (e instanceof LeadApiError && e.code === "DUPLICATE_CLIENT_CANDIDATE") {
        setDuplicateWarning(true);
      } else if (
        e instanceof LeadApiError &&
        e.code === "LEAD_ALREADY_CONVERTED"
      ) {
        setError(t("convert.alreadyConverted"));
        await loadAll();
      } else {
        setError(e instanceof Error ? e.message : t("errors.convertFailed"));
      }
    } finally {
      setConverting(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">{c("loading")}</p>;
  }

  if (!lead) {
    return (
      <div className="space-y-4">
        <Link href="/leads" className="text-sm font-medium hover:underline">
          ← {t("actions.back")}
        </Link>
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    );
  }

  const contacts = lead.contacts || [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/leads" className="text-sm font-medium hover:underline">
          ← {t("actions.back")}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{lead.name}</h1>
          <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(lead.status)}`}>
            {t(`statuses.${lead.status}`)}
          </span>
          {lead.source && (
            <span className="whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-xs">
              {t(`sources.${lead.source}`)}
            </span>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={handleDeleteLead}
              className="ml-auto text-sm font-medium text-red-600 hover:underline"
            >
              {t("actions.delete")}
            </button>
          )}
        </div>
        {lead.company_name && (
          <p className="mt-1 text-sm text-muted-foreground">
            {lead.company_name}
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {converted && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-accent/50 px-4 py-3 text-sm">
          <span className="font-medium text-foreground">
            {t("detail.convertedBanner")}
          </span>
          <Link
            href={`/clients/${lead.converted_client_id}`}
            className="font-medium underline"
          >
            {t("detail.viewClient")}
          </Link>
          <span className="text-muted-foreground">
            {t("detail.mainFieldsLocked")}
          </span>
        </div>
      )}

      {/* Overview */}
      <section className={cardCls}>
        <div className="flex items-center justify-between">
          <h2 className={sectionTitleCls}>{t("detail.overview")}</h2>
          {canUpdate && !editing && !converted && (
            <button
              type="button"
              onClick={startEdit}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              {t("actions.edit")}
            </button>
          )}
        </div>

        {!editing ? (
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {[
              [t("fields.contactName"), lead.contact_name],
              [t("fields.email"), lead.email],
              [t("fields.phone"), lead.phone],
              [t("fields.estimatedValue"), fmtMoney(lead.estimated_value)],
              [t("fields.owner"), lead.owner ? lead.owner.name : null],
              [t("fields.lastContacted"), fmtDate(lead.last_contacted_at)],
              ...(lead.status === "unqualified"
                ? [[t("fields.unqualifiedReason"), lead.unqualified_reason]]
                : []),
            ].map(([label, value]) => (
              <div key={label as string} className="flex gap-2">
                <dt className="font-medium text-foreground">{label}:</dt>
                <dd className="truncate text-muted-foreground">
                  {(value as string) || "—"}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
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
                <Select
                  value={form.source}
                  onValueChange={(v) => setForm({ ...form, source: v })}
                  options={LEAD_SOURCES.map((s) => ({ value: s, label: t(`sources.${s}`) }))}
                  className="w-full"
                />
              </div>
              <div>
                <label className={labelCls}>{t("fields.status")}</label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v })}
                  options={LEAD_STATUSES.map((s) => ({ value: s, label: t(`statuses.${s}`) }))}
                  className="w-full"
                />
              </div>
              <div>
                <label className={labelCls}>
                  {t("fields.estimatedValue")}
                </label>
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
                <Select
                  value={form.owner_id}
                  onValueChange={(v) => setForm({ ...form, owner_id: v })}
                  options={[
                    { value: "", label: "—" },
                    ...users.map((u) => ({ value: String(u.id), label: u.name })),
                  ]}
                  className="w-full"
                />
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
                disabled={saving}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {t("actions.save")}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                {t("actions.cancel")}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Convert */}
      {!converted && canConvert && (
        <section className={cardCls}>
          <h2 className={sectionTitleCls}>{t("convert.title")}</h2>
          <p className="-mt-2 text-sm text-muted-foreground">
            {t("convert.description")}
          </p>
          {duplicateWarning && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {t("convert.duplicateWarning")}
            </div>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px]">
              <label className={labelCls}>{t("convert.manager")}</label>
              <Select
                value={convertManagerId}
                onValueChange={setConvertManagerId}
                options={[
                  { value: "", label: "—" },
                  ...users.map((u) => ({ value: String(u.id), label: u.name })),
                ]}
                className="w-full"
              />
            </div>
            <button
              type="button"
              disabled={converting}
              onClick={() => handleConvert(false)}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {t("actions.convert")}
            </button>
            {duplicateWarning && (
              <button
                type="button"
                disabled={converting}
                onClick={() => handleConvert(true)}
                className="rounded-md border border-amber-300 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50"
              >
                {t("actions.forceConvert")}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Contacts */}
      <section className={cardCls}>
        <h2 className={sectionTitleCls}>{t("detail.contacts")}</h2>
        {contacts.length === 0 ? (
          <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
            {t("detail.noContacts")}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {contacts.map((contact) => (
              <li
                key={contact.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3"
              >
                <span className="font-medium text-foreground">
                  {contact.full_name}
                </span>
                {contact.is_primary && (
                  <span className="whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-xs">
                    {t("contacts.primary")}
                  </span>
                )}
                {contact.position && (
                  <span className="text-sm text-muted-foreground">
                    {contact.position}
                  </span>
                )}
                {contact.email && (
                  <span className="text-sm text-muted-foreground">
                    {contact.email}
                  </span>
                )}
                {contact.phone && (
                  <span className="text-sm text-muted-foreground">
                    {contact.phone}
                  </span>
                )}
                {canUpdate && !converted && (
                  <ActionMenu
                    className="ml-auto"
                    items={[
                      {
                        label: t("actions.edit"),
                        icon: "pencil",
                        onClick: () => {
                          setEditingContact(contact);
                          setContactForm({
                            full_name: contact.full_name,
                            email: contact.email || "",
                            phone: contact.phone || "",
                            position: contact.position || "",
                          });
                          setContactPrimary(contact.is_primary);
                        },
                      },
                      {
                        label: t("actions.delete"),
                        icon: "trash-2",
                        danger: true,
                        onClick: () => handleDeleteContact(contact),
                      },
                    ]}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        {canUpdate && !converted && (
          <form
            onSubmit={handleContactSubmit}
            className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2"
          >
            <input
              required
              placeholder={t("contacts.fullName")}
              value={contactForm.full_name}
              onChange={(e) =>
                setContactForm({ ...contactForm, full_name: e.target.value })
              }
              className={inputCls}
            />
            <input
              placeholder={t("contacts.position")}
              value={contactForm.position}
              onChange={(e) =>
                setContactForm({ ...contactForm, position: e.target.value })
              }
              className={inputCls}
            />
            <input
              type="email"
              placeholder={t("fields.email")}
              value={contactForm.email}
              onChange={(e) =>
                setContactForm({ ...contactForm, email: e.target.value })
              }
              className={inputCls}
            />
            <input
              placeholder={t("fields.phone")}
              value={contactForm.phone}
              onChange={(e) =>
                setContactForm({ ...contactForm, phone: e.target.value })
              }
              className={inputCls}
            />
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={contactPrimary}
                onChange={(e) => setContactPrimary(e.target.checked)}
              />
              {t("contacts.primary")}
            </label>
            <div className="flex gap-3">
              <button
                type="submit"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                {editingContact ? t("actions.save") : t("actions.addContact")}
              </button>
              {editingContact && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingContact(null);
                    setContactForm({
                      full_name: "",
                      email: "",
                      phone: "",
                      position: "",
                    });
                    setContactPrimary(false);
                  }}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  {t("actions.cancel")}
                </button>
              )}
            </div>
          </form>
        )}
      </section>

      {/* Activities */}
      <section className={cardCls}>
        <h2 className={sectionTitleCls}>{t("detail.activities")}</h2>
        {activities.length === 0 ? (
          <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
            {t("detail.noActivities")}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {activities.map((activity) => (
              <li
                key={activity.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3"
              >
                <span className="whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-xs">
                  {t(`activities.types.${activity.type}`)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {fmtDateTime(activity.scheduled_at)}
                </span>
                {activity.note && (
                  <span className="truncate text-sm text-foreground">
                    {activity.note}
                  </span>
                )}
                <span className="whitespace-nowrap rounded-full border border-border px-2 py-0.5 text-xs font-medium">
                  {activity.is_done
                    ? t("activities.done")
                    : t("activities.pending")}
                </span>
                {canActivities && (
                  <ActionMenu
                    className="ml-auto"
                    items={[
                      {
                        label: activity.is_done
                          ? t("actions.reopen")
                          : t("actions.markDone"),
                        icon: activity.is_done ? "rotate-ccw" : "check",
                        onClick: () => handleToggleActivity(activity),
                      },
                      {
                        label: t("actions.delete"),
                        icon: "trash-2",
                        danger: true,
                        onClick: () => handleDeleteActivity(activity),
                      },
                    ]}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        {canActivities && (
          <form
            onSubmit={handleActivitySubmit}
            className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2"
          >
            <Select
              value={activityForm.type}
              onValueChange={(v) => setActivityForm({ ...activityForm, type: v })}
              options={ACTIVITY_TYPES.map((type) => ({ value: type, label: t(`activities.types.${type}`) }))}
              className="w-full"
            />
            <input
              type="datetime-local"
              value={activityForm.scheduled_at}
              onChange={(e) =>
                setActivityForm({
                  ...activityForm,
                  scheduled_at: e.target.value,
                })
              }
              className={inputCls}
            />
            <input
              placeholder={t("activities.note")}
              value={activityForm.note}
              onChange={(e) =>
                setActivityForm({ ...activityForm, note: e.target.value })
              }
              className={inputCls}
            />
            <div>
              <button
                type="submit"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                {t("actions.addActivity")}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Notes */}
      <section className={cardCls}>
        <h2 className={sectionTitleCls}>{t("detail.notes")}</h2>
        <p className="-mt-2 text-sm text-muted-foreground">
          {t("detail.notesHint")}
        </p>
        {notes.length === 0 ? (
          <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
            {t("detail.noNotes")}
          </div>
        ) : (
          <ul className="space-y-3">
            {notes.map((note) => (
              <li
                key={note.id}
                className="rounded-md border border-border p-3 text-sm"
              >
                <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {note.author ? note.author.name : "—"}
                  </span>
                  <span>{fmtDate(note.created_at)}</span>
                  {canNotes &&
                    (isPrivileged || note.author?.id === session?.user.id) && (
                      <ActionMenu
                        className="ml-auto"
                        items={[
                          {
                            label: t("actions.delete"),
                            icon: "trash-2",
                            danger: true,
                            onClick: () => handleDeleteNote(note),
                          },
                        ]}
                      />
                    )}
                </div>
                <p className="whitespace-pre-wrap text-foreground">{note.body}</p>
              </li>
            ))}
          </ul>
        )}
        {canNotes && (
          <form onSubmit={handleNoteSubmit} className="space-y-3">
            <textarea
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              placeholder={t("notes.placeholder")}
              rows={3}
              className={inputCls}
            />
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              {t("actions.addNote")}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
