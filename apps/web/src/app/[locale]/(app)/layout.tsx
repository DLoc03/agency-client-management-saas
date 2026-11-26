import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialog";

export default function InternalAppLayout({ children }: { children: ReactNode }) {
  return (
    <ConfirmDialogProvider>
      <AppShell>{children}</AppShell>
    </ConfirmDialogProvider>
  );
}