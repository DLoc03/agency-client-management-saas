"use client";

import { Icon } from "@/components/shell/Icon";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

export type ActionMenuItem = {
  label: string;
  onClick: () => void;
  danger?: boolean;
};

/**
 * Kebab (three-dot) action menu for data cards (FIX-013, PO convention):
 * card actions live behind one icon button instead of inline text buttons,
 * so a card keeps its size and stays tidy as the number of actions grows.
 * Closes on outside click and on Escape.
 */
export function ActionMenu({
  items,
  className = "",
}: {
  items: ActionMenuItem[];
  className?: string;
}) {
  const t = useTranslations("Common");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  if (items.length === 0) return null;

  return (
    <div
      ref={rootRef}
      className={`relative shrink-0 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label={t("moreActions")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Icon name="more-vertical" className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 min-w-[10rem] overflow-hidden rounded-md border border-border bg-card p-1 text-card-foreground shadow-md"
        >
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={`block w-full rounded px-3 py-2 text-left text-sm transition-colors hover:bg-secondary ${
                item.danger ? "font-medium text-red-600" : ""
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
