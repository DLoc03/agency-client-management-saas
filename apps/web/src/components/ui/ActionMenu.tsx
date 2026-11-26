"use client";

import { Icon } from "@/components/shell/Icon";
import { useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ActionMenuItem = {
  label: string;
  onClick: () => void;
  danger?: boolean;
  /** Icon name from the shared Icon set (eye, pencil, trash-2, ...). */
  icon?: string;
};

type MenuPos = { right: number; top?: number; bottom?: number };

/**
 * Kebab (three-dot) action menu for data cards (FIX-013, PO convention):
 * card actions live behind one icon button instead of inline text buttons,
 * so a card keeps its size and stays tidy as the number of actions grows.
 * Closes on outside click and on Escape.
 *
 * The menu renders through a portal with fixed positioning (FIX-020):
 * an absolutely positioned menu inside a framed table (`overflow-hidden`
 * on the DataTable wrapper) was clipped at the table's edge, so the last
 * rows lost their menu. The portal escapes every clipping ancestor, the
 * position follows the toggle button on scroll/resize, and the menu
 * flips upward when the viewport bottom is too close.
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
  const [pos, setPos] = useState<MenuPos | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const place = () => {
    const btn = buttonRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const right = Math.max(8, window.innerWidth - r.right);
    const menuH = menuRef.current?.offsetHeight ?? 0;
    const flip = menuH > 0 && window.innerHeight - r.bottom < menuH + 8 && r.top > menuH + 8;
    setPos(flip ? { right, bottom: window.innerHeight - r.top + 4 } : { right, top: r.bottom + 4 });
  };

  // Measure and position as soon as the (initially hidden) menu mounts.
  useLayoutEffect(() => {
    if (open) place();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open ]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        rootRef.current && !rootRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onMove = () => place();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open ]);

  if (items.length === 0) return null;

  return (
    <div
      ref={rootRef}
      className={`relative shrink-0 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={t("moreActions")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          if (open) setPos(null);
          setOpen((v) => !v);
        }}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Icon name="more-vertical" className="h-4 w-4" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={
              pos
                ? { top: pos.top, bottom: pos.bottom, right: pos.right }
                : { top: 0, right: 0, visibility: "hidden" }
            }
            className="fixed z-50 min-w-[10rem] overflow-hidden rounded-md border border-border bg-card p-1 text-card-foreground shadow-md"
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
                className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm transition-colors hover:bg-secondary ${
                  item.danger ? "font-medium text-red-600" : ""
                }`}
              >
                {item.icon && <Icon name={item.icon} className="h-4 w-4 shrink-0" />}
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
