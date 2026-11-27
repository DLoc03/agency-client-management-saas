"use client";
import { Icon } from "@/components/shell/Icon";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { Select } from "@/components/ui/Select";
import {
  createInvoice,
  updateInvoice,
  type Invoice,
  type InvoiceCreateInput,
} from "@/lib/invoices/api";
import { formatMoney } from "@/lib/currency";

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const labelCls = "mb-1 block text-sm font-medium";

type InvoiceItemForm = {
  description: string;
  quantity: string;
  unit_price: string;
};

type InvoiceFormProps = {
  mode: "create" | "edit";
  invoice?: Invoice;
  onSuccess: () => void;
};

export function InvoiceForm({ mode, invoice, onSuccess }: InvoiceFormProps) {
  const { session } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("Finance");
  const c = useTranslations("Common");

  const currency = session?.agency.base_currency || "USD";

  const [clients, setClients] = useState<{ id: number; name: string }[]>([]);
  const [projects, setProjects] = useState<Array<{
    id: number;
    name: string;
    client?: { id: number; name: string } | null;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clientId, setClientId] = useState(
    invoice ? String(invoice.client_id) : "",
  );
  const [projectId, setProjectId] = useState(
    invoice ? String(invoice.project_id ?? "") : "",
  );
  const [taxRate, setTaxRate] = useState(
    invoice ? String(invoice.tax_rate ?? "") : "",
  );
  const [issueDate, setIssueDate] = useState(
    invoice ? invoice.issue_date : "",
  );
  const [dueDate, setDueDate] = useState(invoice ? invoice.due_date ?? "" : "");
  const [notes, setNotes] = useState(invoice ? invoice.notes ?? "" : "");

  const [items, setItems] = useState<InvoiceItemForm[]>(
    invoice
      ? invoice.items.map((it) => ({
          description: it.description,
          quantity: String(it.quantity ?? 0),
          unit_price: String(it.unit_price ?? 0),
        }))
      : [{ description: "", quantity: "", unit_price: "" }],
  );

  useEffect(() => {
    import("@/lib/clients/api")
      .then(({ listClients }) => listClients())
      .then((data) => setClients(data))
      .catch(() => setClients([]));
    import("@/lib/projects/api")
      .then(({ listProjects }) => listProjects())
      .then((data) => setProjects(data))
      .catch(() => setProjects([]));
  }, []);

  // Projects of the selected client (FE mitigation for cross-tenant reference;
  // BE-008 does not yet reject a project belonging to another client).
  const filteredProjects = useMemo(() => {
    if (!clientId) return projects;
    const cid = Number(clientId);
    return projects.filter((p) => p.client?.id === cid);
  }, [clientId, projects]);

  const addRow = () =>
    setItems((prev) => [...prev, { description: "", quantity: "", unit_price: "" }]);
  const removeRow = (index: number) =>
    setItems((prev) => prev.filter((_, i) => i !== index));

  const subtotal = useMemo(
    () =>
      items.reduce((sum, it) => {
        const q = Number(it.quantity);
        const p = Number(it.unit_price);
        if (Number.isNaN(q) || Number.isNaN(p)) return sum;
        return sum + q * p;
      }, 0),
    [items],
  );
  const taxRateNum = Number(taxRate);
  const taxAmount = useMemo(
    () => (Number.isNaN(taxRateNum) || taxRate === "" ? 0 : subtotal * (taxRateNum / 100)),
    [subtotal, taxRate, taxRateNum],
  );
  const total = subtotal + taxAmount;

  const validate = useCallback((): string | null => {
    if (!clientId) return t("validation.clientRequired");
    if (items.length === 0) return t("validation.itemsRequired");
    for (const it of items) {
      if (!it.description.trim())
        return t("validation.itemDescriptionRequired");
      if (!it.quantity || Number(it.quantity) <= 0)
        return t("validation.itemQuantityPositive");
      if (it.unit_price === "" || Number(it.unit_price) < 0)
        return t("validation.itemUnitPriceNonNegative");
    }
    if (taxRate !== "" && (Number.isNaN(taxRateNum) || taxRateNum < 0 || taxRateNum > 100))
      return t("validation.taxRateRange");
    return null;
  }, [clientId, items, taxRate, taxRateNum, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const vErr = validate();
    if (vErr) {
      setError(vErr);
      return;
    }
    setLoading(true);
    try {
      const payload: InvoiceCreateInput = {
        client_id: Number(clientId),
        project_id: projectId ? Number(projectId) : null,
        tax_rate: taxRate === "" ? null : taxRateNum,
        issue_date: issueDate || undefined,
        due_date: dueDate || undefined,
        notes: notes || undefined,
        items: items.map((it) => ({
          description: it.description,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
        })),
      };
      if (mode === "create") {
        await createInvoice(payload);
      } else if (invoice) {
        await updateInvoice(invoice.id, payload);
      }
      onSuccess();
    } catch (e) {
      const err = e as { code?: string; message?: string; status?: number };
      if (err.code === "INVOICE_NOT_EDITABLE") {
        setError(t("errors.INVOICE_NOT_EDITABLE"));
      } else if (err.code === "CROSS_TENANT_REFERENCE") {
        setError(t("errors.CROSS_TENANT_REFERENCE"));
      } else {
        setError(
          e instanceof Error ? e.message : t("errors.createFailed"),
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-border bg-card p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>{t("fields.customer")} *</label>
          <Select
            value={clientId}
            onValueChange={setClientId}
            options={[
              { value: "", label: "—" },
              ...clients.map((c) => ({ value: String(c.id), label: c.name })),
            ]}
            className="w-full"
          />
        </div>
        <div>
          <label className={labelCls}>{t("fields.project")}</label>
          <Select
            value={projectId}
            onValueChange={setProjectId}
            options={[
              { value: "", label: "—" },
              ...filteredProjects.map((p) => ({
                value: String(p.id),
                label: p.name,
              })),
            ]}
            className="w-full"
          />
          {clientId && filteredProjects.length === 0 && projects.length > 0 && (
            <p className="mt-1 text-xs text-red-600">
              {t("hints.noProjectsForClient")}
            </p>
          )}
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>{t("fields.notes")}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputCls}
            rows={2}
          />
        </div>
        <div>
          <label className={labelCls}>{t("fields.issueDate")}</label>
          <input
            type="date"
            required
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>{t("fields.dueDate")}</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>{t("fields.taxRate")} (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={taxRate}
            onChange={(e) => setTaxRate(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      {/* Line items */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-foreground">
            {t("detail.lineItems")}
          </h3>
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            <IconPlus />
            {t("actions.addItem")}
          </button>
        </div>
        <div className="hidden sm:grid sm:grid-cols-4 gap-2 mb-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t("fields.description")}
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {t("fields.quantity")}
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {t("fields.unitPrice")}
          </span>
          <span className="text-xs font-medium text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          {items.map((it, index) => (
            <div
              key={index}
              className="grid gap-2 sm:grid-cols-4 items-end"
            >
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground sm:sr-only">
                  {t("fields.description")}
                </label>
                <input
                placeholder={t("fields.description")}
                value={it.description}
                onChange={(e) =>
                  setItems((prev) => {
                    const next = [...prev];
                    next[index] = { ...next[index], description: e.target.value };
                    return next;
                  })
                }
                className={inputCls}
              />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground sm:sr-only">
                  {t("fields.quantity")}
                </label>
                <input
                type="number"
                step="0.01"
                min="0"
                placeholder={t("fields.quantity")}
                value={it.quantity}
                onChange={(e) =>
                  setItems((prev) => {
                    const next = [...prev];
                    next[index] = { ...next[index], quantity: e.target.value };
                    return next;
                  })
                }
                className={inputCls}
              />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground sm:sr-only">
                  {t("fields.unitPrice")}
                </label>
                <input
                type="number"
                step="0.01"
                min="0"
                placeholder={t("fields.unitPrice")}
                value={it.unit_price}
                onChange={(e) =>
                  setItems((prev) => {
                    const next = [...prev];
                    next[index] = { ...next[index], unit_price: e.target.value };
                    return next;
                  })
                }
                className={inputCls}
              />
              </div>
              <button
                type="button"
                onClick={() => removeRow(index)}
                disabled={items.length === 1}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:pointer-events-none"
              ><Icon name="trash-2" className="h-3.5 w-3.5" /> 
                {t("actions.remove")}
              </button>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Totals preview */}
      <div className="mt-4 border-t border-border pt-4">
        <div className="flex justify-end">
          <table className="text-right text-sm">
            <tbody>
              <tr>
                <td className="pr-4 text-muted-foreground">{t("fields.subtotal")}</td>
                <td className="text-foreground">{formatMoney(subtotal, currency, locale) || "0"}</td>
              </tr>
              {taxRate !== "" && (
                <tr>
                  <td className="pr-4 text-muted-foreground">
                    {t("fields.taxRate")} ({taxRate}%)
                  </td>
                  <td className="text-foreground">{formatMoney(taxAmount, currency, locale) || "0"}</td>
                </tr>
              )}
              <tr className="font-bold">
                <td className="pr-4 text-foreground">{t("fields.total")}</td>
                <td className="text-foreground">{formatMoney(total, currency, locale) || "0"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        ><Icon name="check" className="h-4 w-4" /> 
          {loading ? c("loading") : mode === "create" ? t("actions.create") : t("actions.save")}
        </button>
        <button
          type="button"
          onClick={() => router.push("/invoices")}
          disabled={loading}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          {t("actions.back")}
        </button>
      </div>
    </form>
  );
}

function IconPlus() {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
