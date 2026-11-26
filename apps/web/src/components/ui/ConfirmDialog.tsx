"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

type ConfirmIntent = "delete" | "revoke";

type ConfirmRequest = {
  intent?: ConfirmIntent;
};

type ConfirmFn = (message: string, options?: ConfirmRequest) => Promise<boolean>;

type PendingConfirm = {
  message: string;
  intent: ConfirmIntent;
};

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("Common");
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const confirmAction = useCallback<ConfirmFn>((message, options = {}) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setPending({ message, intent: options.intent ?? "delete" });
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setPending(null);
  }, []);

  useEffect(() => {
    if (!pending) return;
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        settle(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [pending, settle]);

  const confirmLabel =
    pending?.intent === "revoke" ? t("actions.revoke") : t("actions.delete");

  return (
    <ConfirmContext.Provider value={confirmAction}>
      {children}
      {pending && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-black/50"
                onClick={() => settle(false)}
              />
              <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-dialog-title"
                aria-describedby="confirm-dialog-message"
                className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-2xl"
              >
                <h2 id="confirm-dialog-title" className="text-lg font-semibold">
                  {confirmLabel}
                </h2>
                <p
                  id="confirm-dialog-message"
                  className="mt-2 text-sm text-muted-foreground"
                >
                  {pending.message}
                </p>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    ref={cancelRef}
                    type="button"
                    onClick={() => settle(false)}
                    className="cursor-pointer rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary motion-reduce:transition-none"
                  >
                    {t("actions.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => settle(true)}
                    className="cursor-pointer rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 motion-reduce:transition-none"
                  >
                    {confirmLabel}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const confirmAction = useContext(ConfirmContext);
  if (!confirmAction) {
    throw new Error("useConfirm must be used within ConfirmDialogProvider");
  }
  return confirmAction;
}
