"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { usePortalAuth } from "@/lib/portal-auth";
import { useTranslations, useLocale } from "next-intl";
import { Icon } from "@/components/shell/Icon";
import { statusBadgeClass } from "@/lib/status-colors";
import { formatMoney } from "@/lib/currency";

export default function PortalInvoicesPage() {
  const { session, isLoading } = usePortalAuth();
  const locale = useLocale();
  const t = useTranslations("Portal.invoices");
  const c = useTranslations("Common");
  const currency = session?.agency?.name ? "USD" : "USD";

  const [invoices, setInvoices] = useState<Array<{
    id: number;
    number: string;
    client: { id: number; name: string };
    project: { id: number; name: string } | null;
    status: string;
    stored_status: string;
    total: string | number;
    balance_due: string | number;
    due_date: string | null;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fmtMoney = (value: string | number | null | undefined) =>
    formatMoney(value, "USD", locale) || "0";

  const fmtDate = (value: string | null | undefined) => {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleDateString(locale);
    } catch {
      return value;
    }
  };

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/portal/invoices", {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error("load failed");
        const body = await res.json();
        if (!cancelled)
          setInvoices(Array.isArray(body.data) ? body.data : []);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (isLoading || loading) return null;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-1 border-b border-slate-100 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {t("title")}
            </h1>
            <p className="mt-1 text-base text-slate-700">
              {t("subtitle", {
                name: session?.client?.name ?? "",
                agency: session?.agency?.name ?? "",
              })}
            </p>
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {t("loadError") || "Không tải được hoá đơn. Vui lòng thử lại."}
          </p>
        ) : invoices.length === 0 ? (
          <div className="my-10 flex flex-col items-center justify-center text-center">
            <Icon name="receipt" className="mb-4 h-12 w-12 text-emerald-600" />
            <p className="text-sm font-medium text-slate-700">
              {t("empty") || "Chưa có hoá đơn nào."}
            </p>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              {t("emptyHint") ||
                "Hoá đơn của agency đối với bạn sẽ hiện ở đây."}
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {invoices.map((invoice) => (
              <li key={invoice.id}>
                <Link
                  href={`/portal/invoices/${invoice.id}`}
                  className="block rounded-xl border border-slate-200 p-4 transition hover:border-emerald-300 hover:shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-medium text-slate-900">
                        {invoice.number}
                      </div>
                      {invoice.project && (
                        <p className="text-xs text-slate-500 truncate max-w-[200px]">
                          {invoice.project.name}
                        </p>
                      )}
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="text-right">
                        <div className="font-semibold text-slate-900">
                          {fmtMoney(invoice.total)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {t("fields.balanceDue")}: {fmtMoney(invoice.balance_due)}
                        </div>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(invoice.status)}`}
                      >
                        {t(`statuses.${invoice.status}`)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span>{t("fields.dueDate")}: {fmtDate(invoice.due_date)}</span>
                    <span>
                      {t("fields.balanceDue")}:{" "}
                      <span className="font-semibold text-slate-900">
                        {fmtMoney(invoice.balance_due)}
                      </span>
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
