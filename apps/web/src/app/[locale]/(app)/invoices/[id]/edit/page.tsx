"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/lib/auth";
import { useTranslations } from "next-intl";
import { getInvoice, type Invoice } from "@/lib/invoices/api";
import { InvoiceForm } from "@/components/invoices/InvoiceForm";
import { Forbidden } from "@/components/ui/Forbidden";

export default function EditInvoicePage() {
  const params = useParams();
  const id = Number(params?.id);
  const router = useRouter();
  const { session, isLoading } = useAuth();
  const t = useTranslations("Finance");

  const canUpdate = !!session?.user.permissions.includes("invoices.create");
  if (isLoading) return null;
  if (!session || !canUpdate || !id) {
    return (
      <Forbidden
        title={t("paymentDetails.forbidden") || "Forbidden"}
        message="Bạn không có quyền sửa hoá đơn."
      />
    );
  }

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notEditable, setNotEditable] = useState(false);

  useEffect(() => {
    getInvoice(id)
      .then((inv) => {
        if (inv.status !== "draft") {
          setNotEditable(true);
        }
        setInvoice(inv);
      })
      .catch((e) => {
        const err = e as { code?: string; message?: string; status?: number };
        if (err.status === 403) {
          setLoadError(
            t("paymentDetails.forbidden") || "Bạn không có quyền xem hoá đơn.",
          );
          return;
        }
        if (err.code === "INVOICE_NOT_EDITABLE") {
          setNotEditable(true);
          setLoadError(t("errors.INVOICE_NOT_EDITABLE") || "Chỉ được sửa hoá đơn Bản nháp.");
        } else {
          setLoadError(e instanceof Error ? e.message : "Không tải được hoá đơn.");
        }
      });
  }, [id, t]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t("actions.save")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("subtitle") || "Chỉ hoá đơn ở trạng thái Bản nháp có thể được sửa."}
        </p>
      </div>

      {notEditable && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {t("errors.INVOICE_NOT_EDITABLE") || "Chỉ được sửa hoá đơn ở trạng thái Bản nháp."}
        </div>
      )}

      {loadError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {!notEditable && invoice && (
        <InvoiceForm
          mode="edit"
          invoice={invoice}
          onSuccess={() => router.push(`/invoices/${id}`)}
        />
      )}
    </div>
  );
}
