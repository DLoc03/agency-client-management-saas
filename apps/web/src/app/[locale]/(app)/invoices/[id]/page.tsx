"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/lib/auth";
import { useTranslations, useLocale } from "next-intl";
import { Icon } from "@/components/shell/Icon";
import { Select } from "@/components/ui/Select";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Forbidden } from "@/components/ui/Forbidden";
import {
  getInvoice,
  deleteInvoice,
  sendInvoice,
  cancelInvoice,
  listPayments,
  recordPayment,
  deletePayment,
  getInvoicePdf,
  type Invoice,
  type InvoiceStatus,
} from "@/lib/invoices/api";
import { statusBadgeClass } from "@/lib/status-colors";
import { formatMoney } from "@/lib/currency";

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const labelCls = "mb-1 block text-sm font-medium";

export default function InvoiceDetailPage() {
  const params = useParams();
  const id = Number(params?.id);
  const router = useRouter();
  const { session, isLoading: authLoading } = useAuth();
  const locale = useLocale();
  const t = useTranslations("Finance");
  const c = useTranslations("Common");

  const currency = session?.agency.base_currency || "USD";

  // Permission matrix (FINANCE_CONTRACT §3).
  const perms = session?.user.permissions ?? [];
  const canSend = perms.includes("invoices.send");
  const canCancel = perms.includes("invoices.cancel");
  const canDelete = perms.includes("invoices.delete");
  const canPdf = perms.includes("invoices.pdf");
  const canManagePayment = perms.includes("payments.manage");

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const confirmAction = useConfirm();
  const [payments, setPayments] = useState<
    Array<{
      id: number;
      amount: string | number;
      paid_on: string;
      method: "bank_transfer" | "cash";
      note: string | null;
      recorded_by_name?: string | null;
    }>
  >([]);

  // Payment form
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState("");
  const [payMethod, setPayMethod] = useState<"bank_transfer" | "cash">("bank_transfer");
  const [payNote, setPayNote] = useState("");
  const [payError, setPayError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [sending, setSending] = useState(false);


  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const inv = await getInvoice(id);
      setInvoice(inv);
      const ps = await listPayments(id);
      setPayments(ps);
    } catch (e) {
      const err = e as { status?: number; code?: string; message?: string };
      if (err.status === 403) {
        setForbidden(true);
        return;
      }
      setError(e instanceof Error ? e.message : t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [id, t, c]);

  useEffect(() => {
    if (authLoading) return;
    load();
  }, [id, authLoading, load]);

  const fmtDate = (value: string | null | undefined) => {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleDateString(locale);
    } catch {
      return value;
    }
  };

  const fmtMoney = (value: string | number | null | undefined) =>
    formatMoney(value, currency, locale) || "0";

  const balanceDue = invoice ? Number(invoice.balance_due || 0) : 0;

  const canRecordPayment =
    invoice &&
    (invoice.status === "sent" || invoice.status === "overdue") &&
    canManagePayment;

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayError(null);
    if (!invoice) return;
    const amount = Number(payAmount);
    if (!payAmount || Number.isNaN(amount) || amount <= 0) {
      setPayError(t("errors.paymentFailed") || "Số tiền không hợp lệ.");
      return;
    }
    // Client-side overpayment guard (FINANCE_CONTRACT 4.4): never exceed balance due.
    if (amount > balanceDue) {
      setPayError(t("errors.OVERPAYMENT_NOT_ALLOWED") || "Số tiền vượt quá số dư còn lại.");
      return;
    }
    setRecording(true);
    try {
      await recordPayment(invoice.id, {
        amount,
        paid_on: payDate || undefined,
        method: payMethod,
        note: payNote || undefined,
      });
      setPayAmount("");
      setPayDate("");
      setPayNote("");
      setPayError(null);
      await load();
    } catch (e) {
      const err = e as { code?: string; message?: string };
      // Inline error shown inside the form, keyed by error code (DEC-025).
      if (err?.code === "OVERPAYMENT_NOT_ALLOWED") {
        setPayError(t("errors.OVERPAYMENT_NOT_ALLOWED") || "Số tiền vượt quá số dư còn lại.");
      } else if (err?.code === "PAYMENT_NOT_ALLOWED") {
        setPayError(t("errors.PAYMENT_NOT_ALLOWED") || "Chỉ ghi nhận thanh toán cho hoá đơn Đã gửi / Quá hạn.");
      } else {
        setPayError(err?.message || t("errors.paymentFailed") || "Ghi nhận thanh toán thất bại.");
      }
    } finally {
      setRecording(false);
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    try {
      await deletePayment(paymentId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.paymentDeleteFailed"));
    }
  };

  const handleSend = async () => {
    if (!invoice) return;
    setSending(true);
    try {
      await sendInvoice(invoice.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.sendFailed"));
    } finally {
      setSending(false);
    }
  };

  const handleCancel = async () => {
    if (!invoice) return;
    setCanceling(true);
    try {
      await cancelInvoice(invoice.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.cancelFailed"));
    } finally {
      setCanceling(false);
    }
  };

  const handleDelete = async () => {
    if (!invoice) return;
    setDeleting(true);
    try {
      await deleteInvoice(invoice.id);
      router.push("/invoices");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    try {
      const blob = await getInvoicePdf(invoice.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoice.number}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tải PDF thất bại.");
    }
  };

  if ((authLoading || loading) && !invoice) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">{c("loading")}</p>
      </div>
    );
  }

  if (forbidden) {
    return <Forbidden />;
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!invoice) return null;

  const subtotal = Number(invoice.subtotal || 0);
  const taxAmount = Number(invoice.tax_amount || 0);
  const total = Number(invoice.total || 0);
  const paidTotal = Number(invoice.paid_total || 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {invoice.number}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(invoice.status)}`}
            >
              {t(`statuses.${invoice.status}`)}
              {invoice.status === "overdue" && (
                <span className="ml-1 text-[10px] opacity-80 whitespace-nowrap">
                  ({t("statuses.overdue")})
                </span>
              )}
              {invoice.status === "overdue" && invoice.stored_status && (
                <span className="ml-1 text-[10px] text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  {t("storedStatus", {
                    status: t(`statuses.${invoice.stored_status as any}`),
                  })}
                </span>
              )}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {invoice.notes || "—"}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Link
            href={`/clients/${invoice.client.id}`}
            className="text-sm font-medium text-foreground hover:underline"
          >
            {invoice.client.name}
          </Link>
          {invoice.project && (
            <Link
              href={`/projects/${invoice.project.id}`}
              className="text-sm font-medium text-foreground hover:underline"
            >
              {invoice.project.name}
            </Link>
          )}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex flex-col">
              <span className="text-muted-foreground text-xs">
                {t("fields.issueDate")}
              </span>
              <span className="text-foreground">{fmtDate(invoice.issue_date)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground text-xs">
                {t("fields.dueDate")}
              </span>
              <span className="text-foreground">{fmtDate(invoice.due_date)}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm mt-2">
            <div className="flex flex-col">
              <span className="text-muted-foreground text-xs">
                {t("fields.total")}
              </span>
              <span className="text-foreground font-medium">{fmtMoney(total)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground text-xs">
                {t("fields.balanceDue")}
              </span>
              <span className="text-foreground font-medium">
                {fmtMoney(balanceDue)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Line items */}
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground mb-3">
          {t("detail.lineItems")}
        </h2>
        <table className="w-full text-sm divide-y divide-border">
          <thead>
            <tr>
              <th className="p-3 text-left text-muted-foreground font-medium">
                {t("fields.description")}
              </th>
              <th className="p-3 text-right text-muted-foreground font-medium w-[80px]">
                {t("fields.quantity")}
              </th>
              <th className="p-3 text-right text-muted-foreground font-medium w-[100px]">
                {t("fields.unitPrice")}
              </th>
              <th className="p-3 text-right text-muted-foreground font-medium w-[100px]">
                {t("fields.amount")}
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} className="group hover:bg-accent/50 transition-colors">
                <td className="p-3 text-foreground">{item.description}</td>
                <td className="p-3 text-right text-muted-foreground">
                  {Number(item.quantity || 0)}
                </td>
                <td className="p-3 text-right text-muted-foreground">
                  {fmtMoney(item.unit_price)}
                </td>
                <td className="p-3 text-right text-foreground font-medium">
                  {fmtMoney(item.amount)}
                </td>
              </tr>
            ))}
            {invoice.items.length === 0 && (
              <tr>
                <td colSpan={4} className="p-3 text-center text-muted-foreground">
                  {t("detail.noItems")}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-muted/50">
            <tr>
              <td className="p-3 text-right text-muted-foreground font-medium colSpan={3}">
                {t("fields.subtotal")}
              </td>
              <td className="p-3 text-right text-foreground">{fmtMoney(subtotal)}</td>
            </tr>
            {invoice.tax_rate != null && (
              <tr>
                <td className="p-3 text-right text-muted-foreground font-medium colSpan={3}">
                  {t("fields.taxAmount")}
                </td>
                <td className="p-3 text-right text-foreground">
                  {fmtMoney(taxAmount)}
                </td>
              </tr>
            )}
            <tr>
              <td className="p-3 text-right text-muted-foreground font-medium colSpan={3}">
                {t("fields.total")}
              </td>
              <td className="p-3 text-right text-foreground font-bold">
                {fmtMoney(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      {/* Payments */}
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground mb-3">
          {t("detail.payments")}
        </h2>

        <div className="space-y-2 mb-4">
          {payments.length > 0 ? (
            <table className="w-full text-sm divide-y divide-border">
              <thead>
                <tr>
                  <th className="p-3 text-left text-muted-foreground font-medium w-[40px]">
                    #
                  </th>
                  <th className="p-3 text-left text-muted-foreground font-medium">
                    {t("fields.amount")}
                  </th>
                  <th className="p-3 text-left text-muted-foreground font-medium">
                    {t("fields.paidOn")}
                  </th>
                  <th className="p-3 text-left text-muted-foreground font-medium">
                    {t("fields.method")}
                  </th>
                  <th className="p-3 text-left text-muted-foreground font-medium">
                    {t("payments.recordedBy")}
                  </th>
                  <th className="p-3 text-right shrink-0"></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="group">
                    <td className="p-3 text-muted-foreground">{p.id}</td>
                    <td className="p-3 text-foreground">{fmtMoney(p.amount)}</td>
                    <td className="p-3 text-muted-foreground">{fmtDate(p.paid_on)}</td>
                    <td className="p-3 text-muted-foreground">
                      {p.method === "bank_transfer"
                        ? t("payments.methodBankTransfer")
                        : t("payments.methodCash")}
                    </td>
                    <td className="p-3 text-muted-foreground truncate max-w-[140px]">
                      {p.recorded_by_name ?? "—"}
                    </td>
                    <td className="p-3 text-right">
                      {canManagePayment && (
                        <ActionMenu
                          items={[
                            {
                              label: t("actions.delete"),
                              danger: true,
                              onClick: async () => {
                                if (
                                  await confirmAction(t("confirmDeletePayment"), {
                                    intent: "delete",
                                  })
                                ) {
                                  await handleDeletePayment(p.id);
                                }
                              },
                            },
                          ]}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-3 text-center text-muted-foreground">
              {t("payments.noPayments")}
            </p>
          )}
        </div>

        {/* Record payment form (only Sent/Overdue + payments.manage). */}
        {canRecordPayment && (
          <form onSubmit={handleRecordPayment} className="space-y-4 pt-4 border-t border-border">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className={labelCls}>{t("fields.amount")} *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>{t("fields.paidOn")}</label>
                <input
                  type="date"
                  required
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>{t("fields.method")}</label>
                <Select
                  value={payMethod}
                  onValueChange={(v) => setPayMethod(v as "bank_transfer" | "cash")}
                  options={[
                    {
                      value: "bank_transfer",
                      label: t("payments.methodBankTransfer"),
                    },
                    { value: "cash", label: t("payments.methodCash") },
                  ]}
                  className="w-full"
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>{t("fields.note")}</label>
              <input
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                className={inputCls}
              />
            </div>
            {payError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {payError}
              </div>
            )}
            <button
              type="submit"
              disabled={recording}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {recording ? c("loading") : t("actions.recordPayment")}
            </button>
          </form>
        )}
      </section>

      {/* Agency bank / VietQR details */}
      {invoice.agency_payment_details && (
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-base font-semibold text-foreground mb-3">
            {t("detail.bankDetails")}
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="text-muted-foreground w-[160px]">
                {t("paymentDetails.bankName")}
              </dt>
              <dd className="text-foreground">
                {invoice.agency_payment_details.bank_name || "—"}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground w-[160px]">
                {t("paymentDetails.bankAccountNumber")}
              </dt>
              <dd className="text-foreground truncate">
                {invoice.agency_payment_details.bank_account_number || "—"}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground w-[160px]">
                {t("paymentDetails.bankAccountHolder")}
              </dt>
              <dd className="text-foreground">
                {invoice.agency_payment_details.bank_account_holder || "—"}
              </dd>
            </div>
            {invoice.agency_payment_details.vietqr_payload && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground w-[160px]">
                  {t("paymentDetails.vietqrPayload")}
                </dt>
                <dd className="text-foreground truncate text-xs">
                  {invoice.agency_payment_details.vietqr_payload}
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {invoice.status === "draft" && (
          <>
            <button
              type="button"
              disabled={!invoice.items.length || sending}
              onClick={handleSend}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {sending ? c("loading") : t("actions.send")}
            </button>
            {canDelete && (
              <button
                type="button"
                disabled={deleting}
                onClick={async () => {
                  if (
                    await confirmAction(t("confirmDelete"), { intent: "delete" })
                  ) {
                    await handleDelete();
                  }
                }}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {t("actions.delete")}
              </button>
            )}
          </>
        )}
        {invoice.status === "sent" && canCancel && (
          <button
            type="button"
            disabled={canceling}
            onClick={async () => {
              if (
                await confirmAction(t("confirmCancel"), {
                  confirmLabel: t("actions.cancelInvoice"),
                })
              ) {
                await handleCancel();
              }
            }}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            {t("actions.cancel")}
          </button>
        )}
        {canPdf && (
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <Icon name="download" className="h-4 w-4 mr-2" />
            {t("actions.downloadPdf")}
          </button>
        )}
      </div>

    </div>
  );
}
