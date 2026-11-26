"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { InvoiceForm } from "@/components/invoices/InvoiceForm";
import { Forbidden } from "@/components/ui/Forbidden";

export default function NewInvoicePage() {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations("Finance");

  const canCreate = !!session?.user.permissions.includes("invoices.create");
  if (isLoading) return null;
  if (!session || !canCreate) {
    return <Forbidden />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t("actions.newInvoice")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>
      <InvoiceForm mode="create" onSuccess={() => router.push("/invoices")} />
    </div>
  );
}
