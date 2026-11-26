"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Link } from "@/i18n/routing";
import { usePortalAuth } from "@/lib/portal-auth";
import { useTranslations, useLocale } from "next-intl";
import { Icon } from "@/components/shell/Icon";
import { statusBadgeClass } from "@/lib/status-colors";
import { formatMoney } from "@/lib/currency";

export default function PortalInvoiceDetailPage() {
  const params = useParams();
  const id = Number(params?.id);
  const { session, isLoading } = usePortalAuth();
  const locale = useLocale();
  const t = useTranslations("Portal.invoices");
  const c = useTranslations("Common");
  const currency = "USD";

  const [invoice, setInvoice] = useState<{
    id: number;
    number: string;
    client: { id: number; name: string };
    project: { id: number; name: string } | null;
    status: string;
    stored_status: string;
    issue_date: string;
    due_date: string | null;
    notes: string | null;
    total: string | number;
    balance_due: string | number;
    items: Array<{
      id: number;
      description: string;
      quantity: string | number;
      unit_price: string | number;
      amount: string | number;
    }>;
    agency_payment_details: {
      bank_name: string | null;
      bank_account_number: string | null;
      bank_account_holder: string | null;
      vietqr_payload: string | null;
    } | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fmtMoney = (value: string | number | null | undefined) =>
    formatMoney(value, currency, locale) || "0";

  const fmtDate = (value: string | null | undefined) => {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleDateString(locale);
    } catch {
      return value;
    }
  };

  useEffect(() => {
    if (!session || !id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/portal/invoices/${id}`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error("load failed");
        const body = await res.json();
        if (!cancelled) setInvoice(body.data || null);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, id]);

  if (isLoading || loading) return null;

  if (error || !invoice) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 shadow-sm text-center">
          <h2 className="text-lg font-bold text-red-800">
            {t("notFound") || "Không tìm thấy hoá đơn."}
          </h2>
          <p className="mt-2 text-sm text-red-700">{t("loadError")}</p>
        </div>
      </main>
    );
  }

  const subtotal = Number(invoice.total || 0) - Number(invoice.balance_due || 0);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {invoice.number}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 mt-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(invoice.status)}`}
            >
              {invoice.status === "overdue"
                ? t("statuses.overdue")
                : invoice.status}
            </span>
          </div>
          <div className="text-right mt-4 sm:mt-0">
            <div className="text-lg font-semibold text-slate-900">
              {fmtMoney(invoice.total)}
            </div>
            <div className="text-xs text-slate-500">
              {t("fields.balanceDue")}: {fmtMoney(invoice.balance_due)}
            </div>
          </div>
        </div>

        <dl className="grid gap-2 sm:grid-cols-3 text-sm">
          <div className="col-span-3 sm:col-span-1">
            <dt className="text-slate-500 text-xs">
              {t("fields.customer")}
            </dt>
            <dd className="text-slate-900">{invoice.client.name}</dd>
          </div>
          {invoice.project && (
            <div className="col-span-3 sm:col-span-1">
              <dt className="text-slate-500 text-xs">
                {t("fields.project")}
              </dt>
              <dd className="text-slate-900">{invoice.project.name}</dd>
            </div>
          )}
          <div className="col-span-3 sm:col-span-1">
            <dt className="text-slate-500 text-xs">
              {t("fields.issueDate")}
            </dt>
            <dd className="text-slate-900">{fmtDate(invoice.issue_date)}</dd>
          </div>
          <div className="col-span-3 sm:col-span-1">
            <dt className="text-slate-500 text-xs">
              {t("fields.dueDate")}
            </dt>
            <dd className="text-slate-900">{fmtDate(invoice.due_date)}</dd>
          </div>
        </dl>

        {invoice.notes && (
          <div className="mt-6">
            <dt className="text-slate-500 text-xs mb-1">
              {t("fields.notes")}
            </dt>
            <dd className="text-slate-700">{invoice.notes}</dd>
          </div>
        )}

        {/* Line items */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">
            {t("detail.lineItems")}
          </h2>
          <table className="w-full text-sm divide-y divide-slate-200">
            <thead>
              <tr>
                <th className="p-3 text-left text-slate-500 text-xs font-medium">
                  {t("fields.description")}
                </th>
                <th className="p-3 text-right text-slate-500 text-xs font-medium w-[80px]">
                  {t("fields.quantity")}
                </th>
                <th className="p-3 text-right text-slate-500 text-xs font-medium w-[100px]">
                  {t("fields.amount")}
                </th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <td className="p-3 text-slate-700">{item.description}</td>
                  <td className="p-3 text-right text-slate-700">
                    {Number(item.quantity || 0)}
                  </td>
                  <td className="p-3 text-right text-slate-700">
                    {fmtMoney(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bank / VietQR details for the client to transfer */}
        {invoice.agency_payment_details && (
          <div className="mt-8 rounded-lg border border-emerald-100 bg-emerald-50 p-6">
            <h2 className="text-lg font-semibold text-emerald-900 mb-3">
              {t("detail.bankDetails")}
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="text-emerald-700 text-xs w-[160px]">
                  {t("paymentDetails.bankName")}
                </dt>
                <dd className="text-slate-900">
                  {invoice.agency_payment_details.bank_name || "—"}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-emerald-700 text-xs w-[160px]">
                  {t("paymentDetails.bankAccountNumber")}
                </dt>
                <dd className="text-slate-900 truncate">
                  {invoice.agency_payment_details.bank_account_number || "—"}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-emerald-700 text-xs w-[160px]">
                  {t("paymentDetails.bankAccountHolder")}
                </dt>
                <dd className="text-slate-900">
                  {invoice.agency_payment_details.bank_account_holder || "—"}
                </dd>
              </div>
              {invoice.agency_payment_details.vietqr_payload && (
                <div className="flex gap-2">
                  <dt className="text-emerald-700 text-xs w-[160px]">
                    {t("paymentDetails.vietqrPayload")}
                  </dt>
                  <dd className="text-slate-900 truncate text-xs">
                    {invoice.agency_payment_details.vietqr_payload}
                  </dd>
                </div>
              )}
            </dl>
            <p className="mt-3 text-xs text-emerald-600">
              {t("portalPayHint") || "Vui lòng chuyển số tiền đúng hoá đơn vào tài khoản trên."}
            </p>
          </div>
        )}
      </div>
      <div className="mt-6">
        <Link
          href="/portal/invoices"
          className="text-sm font-medium text-emerald-700 hover:underline flex items-center gap-1"
        >
          <Icon name="chevron-left" className="h-4 w-4" />
          {t("detail.back") || "Về danh sách hoá đơn"}
        </Link>
      </div>
    </main>
  );
}
