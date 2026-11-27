"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useRouter } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { Icon } from "@/components/shell/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { Forbidden, isForbiddenError } from "@/components/ui/Forbidden";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Select";
import {
  createContact,
  createNote,
  createPortalAccount,
  deleteClient,
  deleteContact,
  deleteNote,
  getClient,
  listDirectoryUsers,
  listNotes,
  listPortalAccounts,
  listTags,
  setPortalAccountActive,
  updateClient,
  updateContact,
} from "@/lib/clients/api";
import { listInvitations } from "@/lib/team/api";
import { statusBadgeClass } from "@/lib/status-colors";
import type {
  Client,
  ClientNote,
  ClientStatus,
  Contact,
  DirectoryUser,
  PortalAccount,
  PortalInvitation,
  Tag,
} from "@/lib/clients/types";
import type { Invitation } from "@/lib/team/types";

const CLIENT_STATUSES: ClientStatus[] = ["active", "paused", "churned"];

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const labelCls = "mb-1 block text-sm font-medium";
const cardCls = "space-y-4 rounded-lg border border-border bg-card p-5";
const sectionTitleCls = "text-base font-semibold text-foreground";

export default function ClientDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("Clients");
  const confirmAction = useConfirm();
  const c = useTranslations("Common");

  const [client, setClient] = useState<Client | null>(null);
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [accounts, setAccounts] = useState<PortalAccount[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PortalInvitation[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [formTags, setFormTags] = useState<number[]>([]);

  const [contactForm, setContactForm] = useState<Record<string, string>>({
    full_name: "",
    email: "",
    phone: "",
    position: "",
  });
  const [contactPrimary, setContactPrimary] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  const [noteBody, setNoteBody] = useState("");
  const [accountForm, setAccountForm] = useState<Record<string, string>>({
    email: "",
    locale: "en",
  });

  useEffect(() => {
    if (!isLoading && !session) router.replace("/login");
  }, [isLoading, session, router]);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cl, ns, accs, tg, us, invs] = await Promise.all([
        getClient(id),
        listNotes(id).catch(() => [] as ClientNote[]),
        listPortalAccounts(id).catch(() => [] as PortalAccount[]),
        listTags().catch(() => [] as Tag[]),
        listDirectoryUsers().catch(() => [] as DirectoryUser[]),
        listInvitations().catch(() => [] as Invitation[]),
      ]);
      setClient(cl);
      setNotes(ns);
      setAccounts(accs);
      setTags(tg);
      setUsers(us);
      setPendingInvitations(
        invs
          .filter(
            (inv) =>
              inv.kind === "client" &&
              inv.client_id === id &&
              !inv.accepted_at &&
              !inv.revoked_at
          )
          .map((inv) => ({
            id: inv.id,
            email: inv.email,
            kind: "client" as const,
            client_id: inv.client_id,
            expires_at: inv.expires_at,
            created_at: inv.created_at,
          }))
      );
    } catch (e) {
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, id]);

  const canUpdate = !!session?.user.permissions.includes("clients.update");
  const canDelete = !!session?.user.permissions.includes("clients.delete");
  const canNotes = !!session?.user.permissions.includes("clients.notes.manage");
  const canPortal = !!session?.user.permissions.includes(
    "clients.portal_accounts.manage",
  );
  const isPrivileged =
    !!session?.user.roles.includes("agency_owner") ||
    !!session?.user.roles.includes("admin");

  const startEdit = () => {
    if (!client) return;
    const org = client.organization;
    setForm({
      name: client.name,
      status: client.status,
      email: client.email || "",
      phone: client.phone || "",
      website: client.website || "",
      address: client.address || "",
      tax_code: client.tax_code || "",
      account_manager_id: client.account_manager
        ? String(client.account_manager.id)
        : "",
      org_legal_name: org?.legal_name || "",
      org_industry: org?.industry || "",
      org_size: org?.size || "",
      org_address: org?.address || "",
      org_tax_code: org?.tax_code || "",
      org_website: org?.website || "",
    });
    setFormTags((client.tags || []).map((tag) => tag.id));
    setEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;
    setSaving(true);
    setEditError(null);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        status: form.status,
        email: form.email || null,
        phone: form.phone || null,
        website: form.website || null,
        address: form.address || null,
        tax_code: form.tax_code || null,
        account_manager_id: form.account_manager_id
          ? Number(form.account_manager_id)
          : null,
        tag_ids: formTags,
      };
      if (client.type === "company") {
        payload.organization = {
          legal_name: form.org_legal_name || null,
          industry: form.org_industry || null,
          size: form.org_size || null,
          address: form.org_address || null,
          tax_code: form.org_tax_code || null,
          website: form.org_website || null,
        };
      }
      const updated = await updateClient(id, payload);
      setClient({ ...updated, contacts: client.contacts });
      setEditing(false);
      await loadAll();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : t("errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!(await confirmAction(t("confirmDelete"), { intent: "delete" }))) return;
    try {
      await deleteClient(id);
      router.replace("/clients");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.deleteFailed"));
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactError(null);
    const payload = {
      full_name: contactForm.full_name,
      email: contactForm.email || null,
      phone: contactForm.phone || null,
      position: contactForm.position || null,
      is_primary: contactPrimary,
    };
    try {
      if (editingContact) {
        await updateContact(id, editingContact.id, payload);
      } else {
        await createContact(id, payload);
      }
      setContactForm({ full_name: "", email: "", phone: "", position: "" });
      setContactPrimary(false);
      setEditingContact(null);
      await loadAll();
    } catch (e) {
      setContactError(e instanceof Error ? e.message : t("errors.saveFailed"));
    }
  };

  const handleDeleteContact = async (contact: Contact) => {
    if (!(await confirmAction(t("confirmDeleteContact"), { intent: "delete" }))) return;
    try {
      await deleteContact(id, contact.id);
      await loadAll();
    } catch (e) {
      setContactError(e instanceof Error ? e.message : t("errors.deleteFailed"));
    }
  };

  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteBody.trim()) return;
    setNoteError(null);
    try {
      await createNote(id, noteBody.trim());
      setNoteBody("");
      setNotes(await listNotes(id));
    } catch (e) {
      setNoteError(e instanceof Error ? e.message : t("errors.saveFailed"));
    }
  };

  const handleDeleteNote = async (note: ClientNote) => {
    try {
      await deleteNote(id, note.id);
      setNotes(await listNotes(id));
    } catch (e) {
      setNoteError(e instanceof Error ? e.message : t("errors.deleteFailed"));
    }
  };

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPortalError(null);
    try {
      const result = await createPortalAccount(id, {
        email: accountForm.email,
        locale: accountForm.locale,
      });
      if ("kind" in result && result.kind === "client") {
        setPendingInvitations((current) => [
          ...current.filter((inv) => inv.email !== result.email),
          {
            id: result.id,
            email: result.email,
            kind: "client",
            client_id: result.client_id,
            expires_at: result.expires_at,
            created_at: null,
          },
        ]);
      } else {
        setAccounts(await listPortalAccounts(id));
      }
      setAccountForm({ email: "", locale: "en" });
    } catch (e) {
      const code = (e as { code?: string } | null)?.code;
      if (code === "INVITATION_PENDING" || code === "EMAIL_ALREADY_REGISTERED") {
        setPortalError(t(`errors.${code}`));
      } else {
        setPortalError(e instanceof Error ? e.message : t("errors.saveFailed"));
      }
    }
  };

  const handleToggleAccount = async (account: PortalAccount) => {
    try {
      await setPortalAccountActive(id, account.id, !account.is_active);
      setAccounts(await listPortalAccounts(id));
    } catch (e) {
      setPortalError(e instanceof Error ? e.message : t("errors.saveFailed"));
    }
  };

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale) : t("portal.never");

  if (loading) {
    return <p className="text-sm text-muted-foreground">{c("loading")}</p>;
  }

  if (!client) {
    return (
      <div className="space-y-4">
        <Link href="/clients" className="text-sm font-medium hover:underline">
          ← {t("actions.back")}
        </Link>
        {forbidden ? (
          <Forbidden />
        ) : (
          error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )
        )}
      </div>
    );
  }

  const contacts = client.contacts || [];
  const org = client.organization;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/clients" className="text-sm font-medium hover:underline">
          ← {t("actions.back")}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
          <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(client.status)}`}>
            {t(`statuses.${client.status}`)}
          </span>
          <span className="whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-xs">
            {t(`types.${client.type}`)}
          </span>
          {canDelete && (
            <button
              type="button"
              onClick={handleDeleteClient}
              className="inline-flex items-center justify-center gap-2 ml-auto text-sm font-medium text-red-600 hover:underline"
            ><Icon name="trash-2" className="h-4 w-4" /> 
              {t("actions.delete")}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Overview */}
      <section className={cardCls}>
        <div className="flex items-center justify-between">
          <h2 className={sectionTitleCls}>{t("detail.overview")}</h2>
          {canUpdate && !editing && (
            <button
              type="button"
              onClick={startEdit}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
            ><Icon name="pencil" className="h-4 w-4" /> 
              {t("actions.edit")}
            </button>
          )}
        </div>

        {!editing ? (
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {[
              [t("fields.email"), client.email],
              [t("fields.phone"), client.phone],
              [t("fields.website"), client.website],
              [t("fields.taxCode"), client.tax_code],
              [t("fields.address"), client.address],
              [
                t("fields.manager"),
                client.account_manager ? client.account_manager.name : null,
              ],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-2">
                <dt className="font-medium text-foreground">{label}:</dt>
                <dd className="truncate text-muted-foreground">{value || "—"}</dd>
              </div>
            ))}
            <div className="flex gap-2 sm:col-span-2">
              <dt className="font-medium text-foreground">{t("fields.tags")}:</dt>
              <dd className="flex flex-wrap gap-1">
                {(client.tags || []).length === 0
                  ? "—"
                  : (client.tags || []).map((tag) => (
                      <span
                        key={tag.id}
                        className="whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-xs"
                      >
                        {tag.name}
                      </span>
                    ))}
              </dd>
            </div>
          </dl>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            {editError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {editError}
              </div>
            )}
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
                <label className={labelCls}>{t("fields.status")}</label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v })}
                  options={CLIENT_STATUSES.map((s) => ({ value: s, label: t(`statuses.${s}`) }))}
                  className="w-full"
                />
              </div>
              <div>
                <label className={labelCls}>{t("fields.manager")}</label>
                <Select
                  value={form.account_manager_id}
                  onValueChange={(v) => setForm({ ...form, account_manager_id: v })}
                  options={[
                    { value: "", label: "—" },
                    ...users.map((u) => ({ value: String(u.id), label: u.name })),
                  ]}
                  className="w-full"
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
                <label className={labelCls}>{t("fields.website")}</label>
                <input
                  value={form.website}
                  onChange={(e) =>
                    setForm({ ...form, website: e.target.value })
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>{t("fields.taxCode")}</label>
                <input
                  value={form.tax_code}
                  onChange={(e) =>
                    setForm({ ...form, tax_code: e.target.value })
                  }
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>{t("fields.address")}</label>
                <input
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                  className={inputCls}
                />
              </div>
            </div>

            {client.type === "company" && (
              <fieldset className="space-y-3 rounded-md border border-border p-4">
                <legend className="px-1 text-sm font-medium">
                  {t("fields.organization")}
                </legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  {(
                    [
                      ["org_legal_name", t("fields.legalName")],
                      ["org_industry", t("fields.industry")],
                      ["org_size", t("fields.size")],
                      ["org_tax_code", t("fields.taxCode")],
                      ["org_website", t("fields.website")],
                      ["org_address", t("fields.address")],
                    ] as [string, string][]
                  ).map(([key, label]) => (
                    <div key={key}>
                      <label className={labelCls}>{label}</label>
                      <input
                        value={form[key] || ""}
                        onChange={(e) =>
                          setForm({ ...form, [key]: e.target.value })
                        }
                        className={inputCls}
                      />
                    </div>
                  ))}
                </div>
              </fieldset>
            )}

            {tags.length > 0 && (
              <div>
                <span className={labelCls}>{t("fields.tags")}</span>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <label
                      key={tag.id}
                      className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border border-border px-3 py-1 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={formTags.includes(tag.id)}
                        onChange={() =>
                          setFormTags((prev) =>
                            prev.includes(tag.id)
                              ? prev.filter((x) => x !== tag.id)
                              : [...prev, tag.id],
                          )
                        }
                      />
                      {tag.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              ><Icon name="check" className="h-4 w-4" /> 
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

        {org && !editing && (
          <div className="border-t border-border pt-4">
            <h3 className="mb-2 text-sm font-semibold text-foreground">
              {t("fields.organization")}
            </h3>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              {[
                [t("fields.legalName"), org.legal_name],
                [t("fields.industry"), org.industry],
                [t("fields.size"), org.size],
                [t("fields.taxCode"), org.tax_code],
                [t("fields.website"), org.website],
                [t("fields.address"), org.address],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-2">
                  <dt className="font-medium text-foreground">{label}:</dt>
                  <dd className="truncate text-muted-foreground">
                    {value || "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </section>

      {/* Contacts */}
      <section className={cardCls}>
        <h2 className={sectionTitleCls}>{t("detail.contacts")}</h2>
        {contactError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {contactError}
          </div>
        )}
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
                {canUpdate && (
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
        {canUpdate && (
          <form
            onSubmit={handleContactSubmit}
            className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2"
          >
            <input
              required
              placeholder={`${t("contacts.fullName")} *`}
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
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              ><Icon name="check" className="h-4 w-4" /> 
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

      {/* Notes */}
      <section className={cardCls}>
        <h2 className={sectionTitleCls}>{t("detail.notes")}</h2>
        <p className="-mt-2 text-sm text-muted-foreground">
          {t("detail.notesHint")}
        </p>
        {noteError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {noteError}
          </div>
        )}
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
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            ><Icon name="plus" className="h-4 w-4" /> 
              {t("actions.addNote")}
            </button>
          </form>
        )}
      </section>

      {/* Portal accounts */}
      <section className={cardCls}>
        <h2 className={sectionTitleCls}>{t("detail.portalAccounts")}</h2>
        {portalError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {portalError}
          </div>
        )}
        {accounts.length === 0 && pendingInvitations.length === 0 ? (
          <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
            {t("detail.noPortalAccounts")}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {pendingInvitations.map((invitation) => (
              <li
                key={`pending-${invitation.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3"
              >
                <span className="font-medium text-foreground">
                  {invitation.email}
                </span>
                <span className="whitespace-nowrap rounded-full border border-border px-2 py-0.5 text-xs font-medium">
                  {t("portal.pending")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("portal.invitationSent")} · {t("portal.expires")}:{" "}
                  {fmtDate(invitation.expires_at)}
                </span>
              </li>
            ))}
            {accounts.map((account) => (
              <li
                key={account.id}
                className="flex items-center gap-3 py-3"
              >
                <Avatar name={account.name} seed={account.id} className="h-8 w-8 text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {account.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {account.email}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-right sm:flex-row sm:items-center sm:gap-3">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="whitespace-nowrap rounded-full border border-border px-2 py-0.5 text-xs font-medium">
                      {account.is_active ? t("portal.active") : t("portal.disabled")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t("portal.lastLogin")}: {fmtDate(account.last_login_at)}
                    </span>
                  </div>
                  {canPortal && account.is_active && (
                    <button
                      type="button"
                      onClick={() => handleToggleAccount(account)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
                    >
                      <Icon name="lock" className="h-3.5 w-3.5" />
                      {t("actions.deactivate")}
                    </button>
                  )}
                  {canPortal && !account.is_active && (
                    <button
                      type="button"
                      onClick={() => handleToggleAccount(account)}
                      className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:underline"
                    ><Icon name="check" className="h-3.5 w-3.5" /> 
                      {t("actions.activate")}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {canPortal && (
          <form
            onSubmit={handleAccountSubmit}
            className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2"
          >
            <p className="text-xs text-muted-foreground sm:col-span-2">
              {t("portal.grantHint")}
            </p>
            <input
              required
              type="email"
              placeholder={t("fields.email")}
              value={accountForm.email}
              onChange={(e) =>
                setAccountForm({ ...accountForm, email: e.target.value })
              }
              className={inputCls}
            />
            <Select
              value={accountForm.locale}
              onValueChange={(v) => setAccountForm({ ...accountForm, locale: v })}
              options={[
                { value: "en", label: "English" },
                { value: "vi", label: "Tiếng Việt" },
              ]}
              className="w-full"
            />
            <div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              ><Icon name="user-plus" className="h-4 w-4" /> 
                {t("actions.createAccount")}
              </button>
            </div>
          </form>
        )}
      </section>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon name="building-2" className="h-3.5 w-3.5" />
        {client.name}
      </p>
    </div>
  );
}
