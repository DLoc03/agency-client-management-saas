"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/shell/Icon";
import { Select } from "@/components/ui/Select";
import { ActionMenu } from "@/components/ui/ActionMenu";
import {
  createClient,
  createTag,
  deleteClient,
  listClients,
  listDirectoryUsers,
  listTags,
} from "@/lib/clients/api";
import { statusBadgeClass } from "@/lib/status-colors";
import type {
  Client,
  ClientStatus,
  DirectoryUser,
  Tag,
} from "@/lib/clients/types";

const CLIENT_STATUSES: ClientStatus[] = ["active", "paused", "churned"];

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const labelCls = "mb-1 block text-sm font-medium";

export default function ClientsPage() {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations("Clients");
  const c = useTranslations("Common");

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [users, setUsers] = useState<DirectoryUser[]>([]);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [tagId, setTagId] = useState("");
  const [managerId, setManagerId] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({
    name: "",
    type: "company",
    status: "active",
    email: "",
    phone: "",
    website: "",
    address: "",
    tax_code: "",
    account_manager_id: "",
    org_legal_name: "",
    org_industry: "",
    org_size: "",
    org_address: "",
    org_tax_code: "",
    org_website: "",
  });
  const [formTags, setFormTags] = useState<number[]>([]);

  const [newTagName, setNewTagName] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);

  useEffect(() => {
    if (!isLoading && !session) router.replace("/login");
  }, [isLoading, session, router]);

  useEffect(() => {
    listTags()
      .then(setTags)
      .catch(() => setTags([]));
    listDirectoryUsers()
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listClients({
        q: q || undefined,
        status: status || undefined,
        tag_id: tagId ? Number(tagId) : undefined,
        account_manager_id: managerId ? Number(managerId) : undefined,
      });
      setClients(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, q, status, tagId, managerId]);

  const canCreate = !!session?.user.permissions.includes("clients.create");
  const canDelete = !!session?.user.permissions.includes("clients.delete");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        type: form.type,
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
      if (form.type === "company") {
        payload.organization = {
          legal_name: form.org_legal_name || null,
          industry: form.org_industry || null,
          size: form.org_size || null,
          address: form.org_address || null,
          tax_code: form.org_tax_code || null,
          website: form.org_website || null,
        };
      }
      await createClient(payload);
      setShowCreate(false);
      setFormTags([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.createFailed"));
    } finally {
      setCreating(false);
    }
  };

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    setCreatingTag(true);
    try {
      const tag = await createTag({ name: newTagName.trim() });
      setTags((prev) => [...prev, tag]);
      setNewTagName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.saveFailed"));
    } finally {
      setCreatingTag(false);
    }
  };

  const handleDelete = async (client: Client) => {
    if (!window.confirm(t("confirmDelete"))) return;
    try {
      await deleteClient(client.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.deleteFailed"));
    }
  };

  const toggleFormTag = (id: number) =>
    setFormTags((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

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
            <Icon name="building-2" className="h-4 w-4" />
            {t("newClient")}
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
        <Select
          value={status}
          onValueChange={setStatus}
          options={[
            { value: "", label: `${t("filters.all")} ${t("filters.status")}` },
            ...CLIENT_STATUSES.map((s) => ({ value: s, label: t(`statuses.${s}`) })),
          ]}
          className="w-[190px] max-w-full"
        />
        <Select
          value={tagId}
          onValueChange={setTagId}
          options={[
            { value: "", label: `${t("filters.all")} ${t("filters.tag")}` },
            ...tags.map((tag) => ({ value: String(tag.id), label: tag.name })),
          ]}
          className="w-[190px] max-w-full"
        />
        <Select
          value={managerId}
          onValueChange={setManagerId}
          options={[
            { value: "", label: `${t("filters.all")} ${t("filters.manager")}` },
            ...users.map((u) => ({ value: String(u.id), label: u.name })),
          ]}
          className="w-[190px] max-w-full"
        />
      </div>

      {canCreate && (
        <form onSubmit={handleCreateTag} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1 sm:max-w-xs">
            <label className={labelCls}>{t("tags.name")}</label>
            <input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              className={inputCls}
            />
          </div>
          <button
            type="submit"
            disabled={creatingTag}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {t("newTag")}
          </button>
        </form>
      )}

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
              <label className={labelCls}>{t("fields.type")}</label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v })}
                options={[
                  { value: "company", label: t("types.company") },
                  { value: "individual", label: t("types.individual") },
                ]}
                className="w-full"
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
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{t("fields.taxCode")}</label>
              <input
                value={form.tax_code}
                onChange={(e) => setForm({ ...form, tax_code: e.target.value })}
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>{t("fields.address")}</label>
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>

          {form.type === "company" && (
            <fieldset className="space-y-3 rounded-md border border-border p-4">
              <legend className="px-1 text-sm font-medium">
                {t("fields.organization")}
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>{t("fields.legalName")}</label>
                  <input
                    value={form.org_legal_name}
                    onChange={(e) =>
                      setForm({ ...form, org_legal_name: e.target.value })
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>{t("fields.industry")}</label>
                  <input
                    value={form.org_industry}
                    onChange={(e) =>
                      setForm({ ...form, org_industry: e.target.value })
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>{t("fields.size")}</label>
                  <input
                    value={form.org_size}
                    onChange={(e) =>
                      setForm({ ...form, org_size: e.target.value })
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>{t("fields.taxCode")}</label>
                  <input
                    value={form.org_tax_code}
                    onChange={(e) =>
                      setForm({ ...form, org_tax_code: e.target.value })
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>{t("fields.website")}</label>
                  <input
                    value={form.org_website}
                    onChange={(e) =>
                      setForm({ ...form, org_website: e.target.value })
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>{t("fields.address")}</label>
                  <input
                    value={form.org_address}
                    onChange={(e) =>
                      setForm({ ...form, org_address: e.target.value })
                    }
                    className={inputCls}
                  />
                </div>
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
                      onChange={() => toggleFormTag(tag.id)}
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

      {/* Content */}
      <div className="min-h-[320px]">
        {loading ? (
          <p className="text-sm text-muted-foreground">{c("loading")}</p>
        ) : clients.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
            <Icon name="building-2" className="mb-3 h-8 w-8 text-muted-foreground" />
            <h3 className="text-base font-semibold text-foreground">
              {t("empty.title")}
            </h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {t("empty.description")}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {clients.map((client) => (
              <div
                key={client.id}
                onClick={() => router.push(`/clients/${client.id}`)}
                className="flex cursor-pointer flex-col gap-3 rounded-lg border border-border bg-card p-5 transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/clients/${client.id}`}
                    className="font-semibold text-foreground hover:underline"
                  >
                    {client.name}
                  </Link>
                  <div className="flex shrink-0 items-start gap-1">
                    <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(client.status)}`}>
                      {t(`statuses.${client.status}`)}
                    </span>
                    {canDelete && (
                      <ActionMenu
                        items={[
                          {
                            label: t("actions.delete"),
                            danger: true,
                            onClick: () => handleDelete(client),
                          },
                        ]}
                      />
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="whitespace-nowrap rounded-full bg-accent px-2 py-0.5">
                    {t(`types.${client.type}`)}
                  </span>
                  {(client.tags || []).map((tag) => (
                    <span
                      key={tag.id}
                      className="whitespace-nowrap rounded-full bg-accent px-2 py-0.5"
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
                <dl className="space-y-1 text-sm text-muted-foreground">
                  {client.account_manager && (
                    <div className="flex gap-2">
                      <dt className="font-medium text-foreground">
                        {t("fields.manager")}:
                      </dt>
                      <dd className="truncate">{client.account_manager.name}</dd>
                    </div>
                  )}
                  {client.email && (
                    <div className="flex gap-2">
                      <dt className="font-medium text-foreground">
                        {t("fields.email")}:
                      </dt>
                      <dd className="truncate">{client.email}</dd>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex gap-2">
                      <dt className="font-medium text-foreground">
                        {t("fields.phone")}:
                      </dt>
                      <dd className="truncate">{client.phone}</dd>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <dt className="font-medium text-foreground">
                      {t("fields.portalAccounts")}:
                    </dt>
                    <dd>{client.portal_accounts_count ?? 0}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
