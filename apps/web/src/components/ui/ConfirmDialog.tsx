"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/shell/Icon";

export type ConfirmDialogProps = {
  /** Whether the dialog is visible. */
  open: boolean;
  /** Action to run when the user confirms. May be async; set `loading` while it runs. */
  onConfirm: () => void | Promise<void>;
  /** Action to run when the user cancels or closes the dialog. */
  onCancel?: () => void;
  /** Dialog title (translated by the caller). */
  title?: string;
  /** Dialog description (translated by the caller). */
  description?: string;
  /** Label of the confirm button. */
  confirmLabel?: string;
  /** Label of the cancel button. */
  cancelLabel?: string;
  /** When true, the confirm button is styled as destructive. */
  danger?: boolean;
  /** Set true while `onConfirm` is in flight to disable the confirm button. */
  loading?: boolean;
};

/**
 * Shared confirmation dialog (FIX-026). Replaces every native browser
 * confirmation call so destructive actions go through an explicit,
 * translatable, accessible dialog. Closes on outside click and on Escape.
 */
export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  description,
  confirmLabel,
  cancelLabel,
  danger = false,
  loading = false,
}: ConfirmDialogProps) {
  const c = useTranslations("Common");
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = useCallback(async () => {
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  }, [onConfirm]);

  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click and Escape while open.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onCancel?.();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel?.();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={title || c("moreActions")}
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onCancel?.()}
      />
      {/* Panel */}
      <div
        className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <h2 className="text-base font-semibold text-foreground">
            {title}
          </h2>
        )}
        {description && (
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
        <div className="mt-6 flex flex-row-reverse gap-3">
          <button
            type="button"
            onClick={() => onCancel?.()}
            disabled={confirming || loading}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
          >
            {cancelLabel || c("cancel") || "Cancel"}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirming || loading}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
              danger
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {confirming ? (c("loading") || "Processing…") : confirmLabel || (danger ? "Delete" : "Confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
