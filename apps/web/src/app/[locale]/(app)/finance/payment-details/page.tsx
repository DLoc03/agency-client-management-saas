"use client";
import { Icon } from "@/components/shell/Icon";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useTranslations } from "next-intl";
import { Forbidden } from "@/components/ui/Forbidden";
import {
  updateAgencyPaymentDetails,
  type AgencyPaymentDetailsInput,
} from "@/lib/invoices/api";

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const labelCls = "mb-1 block text-sm font-medium";

export default function PaymentDetailsPage() {
  const { session, isLoading } = useAuth();
  const t = useTranslations("Finance");
  const c = useTranslations("Common");

  const [data, setData] = useState<AgencyPaymentDetailsInput>({
    bank_name: "",
    bank_account_number: "",
    bank_account_holder: "",
    vietqr_payload: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const perms = session?.user.permissions ?? [];
  const canUpdate = perms.includes("agencies.payment-details.update");
  const agencyId = session?.agency.id ?? 0;

  if (isLoading) return null;
  if (!session || !canUpdate) {
    return <Forbidden />;
  }

  // Note: BE-008 exposes only PATCH for payment details (no GET), so the
  // form starts empty; the saved values are echoed back by the PATCH
  // response and are shown on invoices/PDFs.
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const payload: AgencyPaymentDetailsInput = {
      bank_name: data.bank_name || null,
      bank_account_number: data.bank_account_number || null,
      bank_account_holder: data.bank_account_holder || null,
      vietqr_payload: data.vietqr_payload || null,
    };
    setLoading(true);
    try {
      const res = await updateAgencyPaymentDetails(agencyId, payload);
      setData({
        bank_name: res.bank_name ?? "",
        bank_account_number: res.bank_account_number ?? "",
        bank_account_holder: res.bank_account_holder ?? "",
        vietqr_payload: res.vietqr_payload ?? "",
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("paymentDetails.saveFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t("paymentDetails.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("paymentDetails.subtitle")}
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-4 rounded-lg border border-border bg-card p-5 max-w-2xl">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>{t("paymentDetails.bankName")}</label>
            <input
              value={data.bank_name ?? ""}
              onChange={(e) =>
                setData((d) => ({ ...d, bank_name: e.target.value }))
              }
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              {t("paymentDetails.bankAccountNumber")}
            </label>
            <input
              value={data.bank_account_number ?? ""}
              onChange={(e) =>
                setData((d) => ({
                  ...d,
                  bank_account_number: e.target.value,
                }))
              }
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>
              {t("paymentDetails.bankAccountHolder")}
            </label>
            <input
              value={data.bank_account_holder ?? ""}
              onChange={(e) =>
                setData((d) => ({ ...d, bank_account_holder: e.target.value }))
              }
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>{t("paymentDetails.vietqrPayload")}</label>
            <textarea
              value={data.vietqr_payload ?? ""}
              onChange={(e) =>
                setData((d) => ({ ...d, vietqr_payload: e.target.value }))
              }
              className={inputCls}
              rows={3}
            />
          </div>
        </div>
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {saved && (
          <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {t("paymentDetails.saved")}
          </div>
        )}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          ><Icon name="check" className="h-4 w-4" /> 
            {loading ? c("loading") : t("actions.save")}
          </button>
        </div>
      </form>
    </div>
  );
}
