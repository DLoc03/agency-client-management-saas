"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/lib/auth";
import { useTranslations, useLocale } from "next-intl";
import { Icon } from "@/components/shell/Icon";
import { Select } from "@/components/ui/Select";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Forbidden } from "@/components/ui/Forbidden";
import {
  listInvoices,
  deleteInvoice,
  sendInvoice,
  cancelInvoice,
  getInvoicePdf,
  type InvoiceStatus,
} from "@/lib/invoices/api";
import { statusBadgeClass } from "@/lib/status-colors";
import { formatMoney } from "@/lib/currency";

const PAGE_SIZE = 15;
const SKELETON_DELAY = 200;

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
  const c = useTranslations("Common");

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

  if (!session) return null;
  if (!canView) {
    return (
      <Forbidden
        title={t("paymentDetails.forbidden") || c("forbidden.title")}
        message={
          t("paymentDetails.onlyOwnerAdmin") ||
          c("forbidden.message") ||
          "Bạn không có quyền xem hoá đơn."
        }
      />
    );
  }

  const [clients, setClients] = useState<{ id: number; name: string }[]>([]);
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstLoad, setFirstLoad] = useState(true);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<InvoiceStatus | "">("");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [page, setPage] = useState(1);

  const [openDeleteId, setOpenDeleteId] = useState<number | null>(null);
  const [openCancelId, setOpenCancelId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [cancelingId, setCancelingId] = useState<number | null>(null);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [pdfLoadingId, setPdfLoadingId] = useState<number | null>(null);

  // Inline errors shown at the action button (e.g. INVOICE_EMPTY at Send).
  const [inlineErrors, setInlineErrors] = useState<
    Record<number, { code: string; message: string }>
  >({});

  const clearInlineError = useCallback((id: number) => {
    setInlineErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

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
      await listInvoices({
        q: q || undefined,
        status: status || undefined,
        client_id: clientId ? Number(clientId) : undefined,
        project_id: projectId ? Number(projectId) : undefined,
        page,
        per_page: PAGE_SIZE,
      }).then((data) => {
        setInvoices(data);
      });
    } catch (e) {
      const err = e as { status?: number; message?: string };
      if (err.status === 403) {
        setError(t("errors.loadFailed") || "Forbidden.");
        return;
      }
      setError(
        e instanceof Error
          ? e.message
          : t("errors.loadFailed") || "Lỗi tải hoá đơn.",
      );
    } finally {
      setLoading(false);
      setShowSkeleton(false);
      setFirstLoad(false);
    }
  }, [q, status, clientId, projectId, page, t]);

  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(() => {
      if (firstLoad && loading) setShowSkeleton(true);
    }, SKELETON_DELAY);
    load();
    return () => clearTimeout(timer);
  }, [session, firstLoad, loading, load]);

  useEffect(() => {
    setPage(1);
  }, [q, status, clientId, projectId]);

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await deleteInvoice(id);
      setOpenDeleteId(null);
      await load();
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code === "CANNOT_DELETE_INVOICE") {
        setInlineErrors((prev) => ({
          ...prev,
          [id]: {
            code: err.code ?? "",
            message: err.message || t("errors.CANNOT_DELETE_INVOICE"),
          },
        }));
      } else {
        setError(e instanceof Error ? e.message : t("errors.deleteFailed"));
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleCancel = async (id: number) => {
    setCancelingId(id);
    try {
      await cancelInvoice(id);
      setOpenCancelId(null);
      await load();
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code === "CANNOT_CANCEL_INVOICE") {
        setInlineErrors((prev) => ({
          ...prev,
          [id]: {
            code: err.code ?? "",
            message: err.message || t("errors.CANNOT_CANCEL_INVOICE"),
          },
        }));
      } else {
        setError(e instanceof Error ? e.message : t("errors.cancelFailed"));
      }
    } finally {
      setCancelingId(null);
    }
  };

  const handleSend = async (invoice: InvoiceRow) => {
    clearInlineError(invoice.id);
    if (!invoice.items || invoice.items.length === 0) {
      setInlineErrors((prev) => ({
        ...prev,
        [invoice.id]: {
          code: "INVOICE_EMPTY",
          message: t("errors.INVOICE_EMPTY") || "Hoá đơn chưa có mục nào, không thể gửi.",
        },
      }));
      return;
    }
    setSendingId(invoice.id);
    try {
      await sendInvoice(invoice.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.sendFailed"));
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
      setError(e instanceof Error ? e.message : "Tải PDF thất bại.");
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
        onClick: () => void;
        danger?: boolean;
      }> = [];

      items.push({
        label: t("actions.view"),
        onClick: () => router.push(`/invoices/${invoice.id}`),
      });

      if (invoice.status === "draft" && canSend) {
        items.push({
          label: t("actions.send"),
          onClick: () => handleSend(invoice),
        });
      }
      if (invoice.status === "sent" && canCancel) {
        items.push({
          label: t("actions.cancel"),
          onClick: () => setOpenCancelId(invoice.id),
        });
      }
      if (invoice.status === "draft" && canDelete) {
        items.push({
          label: t("actions.delete"),
          danger: true,
          onClick: () => setOpenDeleteId(invoice.id),
        });
      }
      if (canPdf) {
        items.push({
          label: t("actions.downloadPdf"),
          onClick: () => handleDownloadPdf(invoice.id),
        });
      }
      return items;
    },
    [canSend, canCancel, canDelete, canPdf, t, router, handleSend],
  );

  const fmtMoney = (value: string | number | null | undefined) =>
    formatMoney(value, currency, locale) || "0";

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
            onClick={() => router.push("/invoices/new")}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Icon name="plus" className="h-4 w-4" />
            {t("actions.newInvoice")}
          </button>
        )}
        {canManagePaymentDetails && (
          <button
            type="button"
            onClick={() => router.push("/finance/payment-details")}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {t("paymentDetails.title")}
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
          onValueChange={(v) => setStatus(v as InvoiceStatus | "")}
          options={[
            { value: "", label: `${t("filters.all")} ${t("filters.status")}` },
            ...INVOICE_STATUSES.map((s) => ({
              value: s,
              label: t(`statuses.${s}`),
            })),
          ]}
          className="w-[170px] max-w-full"
        />
        <Select
          value={clientId}
          onValueChange={setClientId}
          options={[
            { value: "", label: `${t("filters.all")} ${t("filters.customer")}` },
            ...clients.map((c) => ({ value: String(c.id), label: c.name })),
          ]}
          className="w-[170px] max-w-full"
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
          className="w-[170px] max-w-full"
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
            {[...Array(PAGE_SIZE)].map((_, i) => (
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
                  const err = inlineErrors[invoice.id];
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
                        {err && (
                          <p className="mt-1 text-xs text-red-600 font-medium whitespace-nowrap">
                            {err.code}: {err.message}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="mt-4 sm:hidden space-y-3">
              {invoices.map((invoice) => {
                const err = inlineErrors[invoice.id];
                return (
                  <div
                    key={invoice.id}
                    className="flex cursor-pointer flex-col gap-3 rounded-lg border border-border bg-card p-4 hover:shadow-md transition-colors"
                    onClick={() => router.push(`/invoices/${invoice.id}`)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-foreground">
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
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">
                          {t("fields.issueDate")}
                        </dt>
                        <dd className="text-foreground">
                          {fmtDate(invoice.issue_date)}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">
                          {t("fields.total")}
                        </dt>
                        <dd className="text-foreground font-medium">
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
                      {err && (
                        <p className="mt-1 text-xs text-red-600 font-medium">
                          {err.code}: {err.message}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination (server-driven in production; here we track the page). */}
            <div className="mt-6 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Trang {page}
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={page === 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-md border border-border px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  {c("prev") || "Trước"}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-md border border-border px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  {c("next") || "Tiếp"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {openDeleteId && (
        <ConfirmDialog
          open
          title={t("confirmDelete")}
          confirmLabel={t("actions.delete")}
          cancelLabel={c("cancel")}
          danger
          loading={deletingId === openDeleteId}
          onConfirm={() => handleDelete(openDeleteId)}
          onCancel={() => setOpenDeleteId(null)}
        />
      )}
      {openCancelId && (
        <ConfirmDialog
          open
          title={t("confirmCancel")}
          confirmLabel={t("actions.cancel")}
          cancelLabel={c("cancel")}
          danger
          loading={cancelingId === openCancelId}
          onConfirm={() => handleCancel(openCancelId)}
          onCancel={() => setOpenCancelId(null)}
        />
      )}
    </div>
  );
}
