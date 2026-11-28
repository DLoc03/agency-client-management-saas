"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/lib/auth";
import { useTranslations, useLocale } from "next-intl";
import { Icon } from "@/components/shell/Icon";
import { Select } from "@/components/ui/Select";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Forbidden } from "@/components/ui/Forbidden";
import { useDelayedSkeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import {
  listInvoicesPage,
  deleteInvoice,
  sendInvoice,
  cancelInvoice,
  getInvoicePdf,
  type InvoiceStatus,
} from "@/lib/invoices/api";
import { statusBadgeClass } from "@/lib/status-colors";
import { formatMoney } from "@/lib/currency";

const DEFAULT_PAGE_SIZE = 10;

const INVOICE_STATUSES: InvoiceStatus[] = [
  "draft",
  "sent",
  "paid",
  "overdue",
  "cancelled",
];

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const labelCls = "mb-1 block text-sm font-medium";

type InvoiceRow = {
  id: number;
  number: string;
  client: { id: number; name: string };
  project: { id: number; name: string } | null;
  status: InvoiceStatus;
  stored_status: string;
  issue_date: string;
  total: string | number;
  items: { id: number }[];
  payments: { id: number; amount: string | number }[];
};

export default function InvoicesPage() {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("Finance");

  const currency = session?.agency.base_currency || "USD";

  // Permission matrix (FINANCE_CONTRACT §3).
  const canView = !!session?.user.permissions.includes("invoices.view");
  const canCreate = !!session?.user.permissions.includes("invoices.create");
  const canSend = !!session?.user.permissions.includes("invoices.send");
  const canCancel = !!session?.user.permissions.includes("invoices.cancel");
  const canDelete = !!session?.user.permissions.includes("invoices.delete");
  const canPdf = !!session?.user.permissions.includes("invoices.pdf");
  const canManagePaymentDetails = !!session?.user.permissions.includes(
    "agencies.payment-details.update",
  );

  const [clients, setClients] = useState<{ id: number; name: string }[]>([]);
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const confirmAction = useConfirm();
  // DEC-021 §9: skeleton only for the first/cold load, via the shared hook
  // (same pattern as the Clients/Projects lists).
  const showSkeleton = useDelayedSkeleton(loading && !hasLoaded);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<InvoiceStatus | "">("");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);

  const [sendingId, setSendingId] = useState<number | null>(null);
  const [pdfLoadingId, setPdfLoadingId] = useState<number | null>(null);

  const fetchReference = useCallback(() => {
    import("@/lib/clients/api")
      .then(({ listClients }) => listClients())
      .then((data) => setClients(data))
      .catch(() => setClients([]));
    import("@/lib/projects/api")
      .then(({ listProjects }) => listProjects())
      .then((data) => setProjects(data))
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    if (!session) return;
    fetchReference();
  }, [session, fetchReference]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Keep showing the previous page of data while the next one loads
    // (keepPreviousData behaviour without TanStack Query).
    try {
      const res = await listInvoicesPage({
        q: q || undefined,
        status: status || undefined,
        client_id: clientId ? Number(clientId) : undefined,
        project_id: projectId ? Number(projectId) : undefined,
        page,
        per_page: perPage,
      });
      setInvoices(res.data || []);
      setTotal(res.meta?.total ?? res.data?.length ?? 0);
      setLastPage(res.meta?.last_page ?? 1);
    } catch (e) {
      const err = e as { status?: number; message?: string };
      if (err.status === 403) {
        setForbidden(true);
        return;
      }
      setError(t("errors.loadFailed"));
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  }, [q, status, clientId, projectId, page, perPage, t]);

  useEffect(() => {
    if (!session) return;
    load();
  }, [session, load]);

  useEffect(() => {
    setPage(1);
  }, [q, status, clientId, projectId]);

  useEffect(() => {
    if (page > lastPage) setPage(lastPage);
  }, [page, lastPage]);

  const handleDelete = async (id: number) => {
    setError(null);
    try {
      await deleteInvoice(id);
      await load();
    } catch (e) {
      const err = e as { code?: string };
      setError(
        err.code === "CANNOT_DELETE_INVOICE"
          ? t("errors.CANNOT_DELETE_INVOICE")
          : t("errors.deleteFailed"),
      );
    }
  };

  const handleCancel = async (id: number) => {
    setError(null);
    try {
      await cancelInvoice(id);
      await load();
    } catch (e) {
      const err = e as { code?: string };
      setError(
        err.code === "CANNOT_CANCEL_INVOICE"
          ? t("errors.CANNOT_CANCEL_INVOICE")
          : t("errors.cancelFailed"),
      );
    }
  };

  const handleSend = async (invoice: InvoiceRow) => {
    setError(null);
    setSendingId(invoice.id);
    try {
      await sendInvoice(invoice.id);
      await load();
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === "INVOICE_EMPTY") {
        setError(t("errors.INVOICE_EMPTY"));
      } else if (err.code === "INVOICE_NOT_EDITABLE") {
        setError(t("errors.INVOICE_NOT_EDITABLE"));
      } else {
        setError(t("errors.sendFailed"));
      }
    } finally {
      setSendingId(null);
    }
  };

  const handleDownloadPdf = async (id: number) => {
    setPdfLoadingId(id);
    try {
      const blob = await getInvoicePdf(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `INV-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(t("errors.pdfFailed"));
    } finally {
      setPdfLoadingId(null);
    }
  };

  const fmtDate = (value: string | null | undefined) => {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleDateString(locale);
    } catch {
      return value;
    }
  };

  // Actions shown in the kebab menu, gated by status + permission.
  const buildActions = useCallback(
    (invoice: InvoiceRow) => {
      const items: Array<{
        label: string;
        icon: string;
        onClick: () => void;
        danger?: boolean;
      }> = [];

      items.push({
        label: t("actions.view"),
        icon: "eye",
        onClick: () => router.push(`/invoices/${invoice.id}`),
      });

      if (invoice.status === "draft" && canSend) {
        items.push({
          label: t("actions.send"),
          icon: "send",
          onClick: () => handleSend(invoice),
        });
      }
      if (invoice.status === "sent" && canCancel) {
        items.push({
          label: t("actions.cancel"),
          icon: "x",
          onClick: async () => {
            if (
              await confirmAction(t("confirmCancel"), {
                confirmLabel: t("actions.cancelInvoice"),
              })
            ) {
              await handleCancel(invoice.id);
            }
          },
        });
      }
      if (invoice.status === "draft" && canDelete) {
        items.push({
          label: t("actions.delete"),
          icon: "trash-2",
          danger: true,
          onClick: async () => {
            if (
              await confirmAction(t("confirmDelete"), { intent: "delete" })
            ) {
              await handleDelete(invoice.id);
            }
          },
        });
      }
      if (canPdf) {
        items.push({
          label: t("actions.downloadPdf"),
          icon: "download",
          onClick: () => handleDownloadPdf(invoice.id),
        });
      }
      return items;
    },
    [
      canSend,
      canCancel,
      canDelete,
      canPdf,
      t,
      router,
      handleSend,
      handleDelete,
      handleCancel,
      confirmAction,
    ],
  );

  const fmtMoney = (value: string | number | null | undefined) =>
    formatMoney(value, currency, locale) || "0";

  if (!session) return null;
  if (!canView || forbidden) {
    return <Forbidden />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {canCreate && (
            <button
              type="button"
              onClick={() => router.push("/invoices/new")}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Icon name="plus" className="h-4 w-4" />
              {t("actions.newInvoice")}
            </button>
          )}
          {canManagePaymentDetails && (
            <button
              type="button"
              onClick={() => router.push("/finance/payment-details")}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
            ><Icon name="receipt" className="h-4 w-4" /> 
              {t("paymentDetails.title")}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <input
          type="search"
          placeholder={t("filters.search")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm sm:min-w-[180px] sm:flex-1"
        />
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as InvoiceStatus | "")}
          options={[
            { value: "", label: `${t("filters.all")} ${t("filters.status")}` },
            ...INVOICE_STATUSES.map((s) => ({
              value: s,
              label: t(`statuses.${s}`),
            })),
          ]}
          className="w-full max-w-full sm:w-[170px]"
        />
        <Select
          value={clientId}
          onValueChange={setClientId}
          options={[
            { value: "", label: `${t("filters.all")} ${t("filters.customer")}` },
            ...clients.map((c) => ({ value: String(c.id), label: c.name })),
          ]}
          className="w-full max-w-full sm:w-[170px]"
        />
        <Select
          value={projectId}
          onValueChange={setProjectId}
          options={[
            { value: "", label: `${t("filters.all")} ${t("filters.project")}` },
            ...projects.map((p) => ({
              value: String(p.id),
              label: p.name,
            })),
          ]}
          className="w-full max-w-full sm:w-[170px]"
        />
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="min-h-[320px]">
        {showSkeleton ? (
          <div className="space-y-2">
            {[...Array(perPage)].map((_, i) => (
              <div
                key={i}
                className="flex gap-4 rounded-lg border border-border bg-card p-4 animate-pulse"
              >
                <div className="flex-1 h-4 bg-secondary rounded w-1/2" />
                <div className="h-4 bg-secondary rounded w-1/3" />
                <div className="h-4 bg-secondary rounded w-1/4" />
                <div className="h-4 bg-secondary rounded w-1/6 shrink-0" />
                <div className="h-4 bg-secondary rounded w-1/4 shrink-0" />
                <div className="h-4 bg-secondary rounded w-1/6 shrink-0" />
              </div>
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
            <Icon name="receipt" className="mb-3 h-8 w-8 text-muted-foreground" />
            <h3 className="text-base font-semibold text-foreground">
              {t("empty.title")}
            </h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {t("empty.description")}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table (6 core columns + kebab). Row click opens detail. */}
            <div className="hidden lg:block">
            <table className="w-full text-sm border border-border">
              <thead className="bg-muted">
                <tr>
                  <th className="p-3 text-left text-muted-foreground font-medium">
                    {t("fields.invoiceNumber")}
                  </th>
                  <th className="p-3 text-left text-muted-foreground font-medium">
                    {t("fields.customer")}
                  </th>
                  <th className="p-3 text-left text-muted-foreground font-medium">
                    {t("fields.project")}
                  </th>
                  <th className="p-3 text-left text-muted-foreground font-medium">
                    {t("fields.issueDate")}
                  </th>
                  <th className="p-3 text-right text-muted-foreground font-medium">
                    {t("fields.total")}
                  </th>
                  <th className="p-3 text-left text-muted-foreground font-medium">
                    {t("fields.status")}
                  </th>
                  <th className="p-3 text-right shrink-0"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((invoice) => {
                  return (
                    <tr
                      key={invoice.id}
                      className="group cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => router.push(`/invoices/${invoice.id}`)}
                    >
                      <td className="p-3 font-medium text-foreground whitespace-nowrap">
                        {invoice.number}
                      </td>
                      <td className="p-3 truncate max-w-[160px] text-foreground">
                        {invoice.client.name}
                      </td>
                      <td className="p-3 truncate max-w-[140px] text-muted-foreground">
                        {invoice.project?.name || "—"}
                      </td>
                      <td className="p-3 whitespace-nowrap text-muted-foreground">
                        {fmtDate(invoice.issue_date)}
                      </td>
                      <td className="p-3 text-right font-medium text-foreground">
                        {fmtMoney(invoice.total)}
                      </td>
                      <td className="p-3">
                        <span
                          className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(invoice.status)}`}
                        >
                          {t(`statuses.${invoice.status}`)}
                        </span>
                      </td>
                      <td className="p-3 text-right shrink-0">
                        <ActionMenu items={buildActions(invoice)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden space-y-3">
              {invoices.map((invoice) => {
                return (
                  <div
                    key={invoice.id}
                    className="flex cursor-pointer flex-col gap-3 rounded-lg border border-border bg-card p-4 hover:shadow-md transition-colors"
                    onClick={() => router.push(`/invoices/${invoice.id}`)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-foreground break-words">
                          {invoice.number}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground truncate">
                          {invoice.client.name}
                        </div>
                        {invoice.project && (
                          <div className="mt-1 text-xs text-muted-foreground truncate">
                            {t("fields.project")}: {invoice.project.name}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 items-start gap-1">
                        <span
                          className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(invoice.status)}`}
                        >
                          {t(`statuses.${invoice.status}`)}
                        </span>
                      </div>
                    </div>
                    <dl className="space-y-1 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="shrink-0 text-muted-foreground">
                          {t("fields.issueDate")}
                        </dt>
                        <dd className="min-w-0 truncate text-right text-foreground">
                          {fmtDate(invoice.issue_date)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="shrink-0 text-muted-foreground">
                          {t("fields.total")}
                        </dt>
                        <dd className="min-w-0 break-words text-right text-foreground font-medium">
                          {fmtMoney(invoice.total)}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {buildActions(invoice).map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            item.onClick();
                          }}
                          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6">
              <Pagination
                page={page}
                perPage={perPage}
                total={total}
                lastPage={lastPage}
                onPageChange={setPage}
                onPerPageChange={(value) => {
                  setPerPage(value);
                  setPage(1);
                }}
                disabled={loading}
              />
            </div>
          </>
        )}
      </div>

    </div>
  );
}
