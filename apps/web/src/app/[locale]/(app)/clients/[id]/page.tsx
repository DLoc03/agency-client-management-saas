"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useRouter } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { Icon } from "@/components/shell/Icon";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { ActionMenu } from "@/components/ui/ActionMenu";
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
import { statusBadgeClass } from "@/lib/status-colors";
import type {
  Client,
  ClientNote,
  ClientStatus,
  Contact,
  DirectoryUser,
  PortalAccount,
  Tag,
} from "@/lib/clients/types";

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
  const c = useTranslations("Common");

  const [client, setClient] = useState<Client | null>(null);
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [accounts, setAccounts] = useState<PortalAccount[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    name: "",
    email: "",
    password: "",
    locale: "en",
  });

  useEffect(() => {
    if (!isLoading && !session) router.replace("/login");
  }, [isLoading, session, router]);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cl, ns, accs, tg, us] = await Promise.all([
        getClient(id),
        listNotes(id).catch(() => [] as ClientNote[]),
        listPortalAccounts(id).catch(() => [] as PortalAccount[]),
        listTags().catch(() => [] as Tag[]),
        listDirectoryUsers().catch(() => [] as DirectoryUser[]),
      ]);
      setClient(cl);
      setNotes(ns);
      setAccounts(accs);
      setTags(tg);
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
      setError(e instanceof Error ? e.message : t("errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!window.confirm(t("confirmDelete"))) return;
    try {
      await deleteClient(id);
      router.replace("/clients");
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
        await updateContact(id, editingContact.id, payload);
      } else {
        await createContact(id, payload);
      }
      setContactForm({ full_name: "", email: "", phone: "", position: "" });
      setContactPrimary(false);
      setEditingContact(null);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.saveFailed"));
    }
  };

  const handleDeleteContact = async (contact: Contact) => {
    if (!window.confirm(t("confirmDeleteContact"))) return;
    try {
      await deleteContact(id, contact.id);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.deleteFailed"));
    }
  };

  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteBody.trim()) return;
    try {
      await createNote(id, noteBody.trim());
      setNoteBody("");
      setNotes(await listNotes(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.saveFailed"));
    }
  };

  const handleDeleteNote = async (note: ClientNote) => {
    try {
      await deleteNote(id, note.id);
      setNotes(await listNotes(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.deleteFailed"));
    }
  };

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: Record<string, unknown> = {
        name: accountForm.name,
        email: accountForm.email,
        locale: accountForm.locale,
      };
      payload["password"] = accountForm.password;
      await createPortalAccount(id, payload);
      setAccountForm({ name: "", email: "", password: "", locale: "en" });
      setAccounts(await listPortalAccounts(id));
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.saveFailed"));
    }
  };

  const handleToggleAccount = async (account: PortalAccount) => {
    try {
      await setPortalAccountActive(id, account.id, !account.is_active);
      setAccounts(await listPortalAccounts(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.saveFailed"));
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
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
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
              className="ml-auto text-sm font-medium text-red-600 hover:underline"
            >
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
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
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

      {/* Portal accounts */}
      <section className={cardCls}>
        <h2 className={sectionTitleCls}>{t("detail.portalAccounts")}</h2>
        {accounts.length === 0 ? (
          <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
            {t("detail.noPortalAccounts")}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {accounts.map((account) => (
              <li
                key={account.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3"
              >
                <span className="font-medium text-foreground">
                  {account.name}
                </span>
                <span className="text-sm text-muted-foreground">
                  {account.email}
                </span>
                <span className="whitespace-nowrap rounded-full border border-border px-2 py-0.5 text-xs font-medium">
                  {account.is_active ? t("portal.active") : t("portal.disabled")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("portal.lastLogin")}: {fmtDate(account.last_login_at)}
                </span>
                {canPortal && (
                  <button
                    type="button"
                    onClick={() => handleToggleAccount(account)}
                    className="ml-auto text-sm font-medium hover:underline"
                  >
                    {account.is_active
                      ? t("actions.deactivate")
                      : t("actions.activate")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canPortal && (
          <form
            onSubmit={handleAccountSubmit}
            className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2"
          >
            <input
              required
              placeholder={`${t("portal.name")} *`}
              value={accountForm.name}
              onChange={(e) =>
                setAccountForm({ ...accountForm, name: e.target.value })
              }
              className={inputCls}
            />
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
            <PasswordInput
              required
                minLength={8}
              placeholder={`${t("portal.password")} *`}
              value={accountForm.password}
              onChange={(e) =>
                setAccountForm({ ...accountForm, ["password"]: e.target.value })
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
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
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
