/**
 * AgencySwitcher — FE-014
 * Sits directly under the sidebar brand block. Shows a static workspace name
 * for a single membership, or a full-row-click menu for two or more.
 */

"use client";

import { clientGetMemberships, clearSession, useAuth, type AgencyMembership } from "@/lib/auth";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Skeleton, useDelayedSkeleton } from "@/components/ui/Skeleton";
import { Icon } from "./Icon";

export function AgencySwitcher() {
  const t = useTranslations("Shell");
  const locale = useLocale();
  const { session, switchAgency } = useAuth();
  const [memberships, setMemberships] = useState<AgencyMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [switchError, setSwitchError] = useState(false);
  const [open, setOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const showSkeleton = useDelayedSkeleton(loading);
  const currentAgencyId = session?.agency.id;

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    async function loadMemberships() {
      const result = await clientGetMemberships(locale);
      if (!mounted) return;
      if (result.success) {
        setMemberships(result.memberships);
        setError(false);
        setSwitchError(false);
      } else {
        setMemberships([]);
        setError(true);
      }
      setLoading(false);
    }

    loadMemberships();
    return () => {
      mounted = false;
    };
  }, [locale, currentAgencyId]);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  const roleLabel = (role: string) => {
    const key = `roles.${role}`;
    try {
      return t(key as never);
    } catch {
      return role;
    }
  };

  const handleSwitch = async (membership: AgencyMembership) => {
    if (switchingId !== null || !session) return;
    if (membership.agency.id === session.agency.id) {
      setOpen(false);
      return;
    }

    setOpen(false);
    setSwitchError(false);
    setSwitchingId(membership.id);
    const result = await switchAgency(membership.id);

    if (!result) {
      clearSession();
      window.location.assign(`/${locale}/dashboard`);
      return;
    }

    setSwitchingId(null);
    setSwitchError(true);
    setOpen(true);
  };

  const canSwitch = memberships.length >= 2;

  return (
    <div className="relative border-b border-sidebar-border px-3 py-2" ref={wrapperRef}>
      {showSkeleton ? (
        <div className="flex h-9 items-center gap-2 px-1" aria-hidden="true">
          <Skeleton className="h-4 w-4 shrink-0 bg-sidebar-accent" />
          <Skeleton className="h-4 w-2/3 bg-sidebar-accent" />
        </div>
      ) : canSwitch ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={t("agencySwitcher.label")}
          className="flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-left transition-colors hover:bg-sidebar-accent/60"
        >
          <Icon name="building-2" className="h-4 w-4 shrink-0 text-sidebar-muted" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-sidebar-foreground">
            {session?.agency.name}
          </span>
          {switchingId !== null && (
            <span className="shrink-0 text-[10px] text-sidebar-muted">
              {t("agencySwitcher.switching")}
            </span>
          )}
          <Icon
            name="chevron-left"
            className={`h-4 w-4 shrink-0 text-sidebar-muted transition-transform ${
              open ? "rotate-90" : "-rotate-90"
            }`}
          />
        </button>
      ) : (
        <div className="flex h-9 items-center gap-2 px-1">
          <Icon name="building-2" className="h-4 w-4 shrink-0 text-sidebar-muted" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-sidebar-foreground">
            {session?.agency.name}
          </span>
        </div>
      )}

      {(error || switchError) && !showSkeleton && (
        <p className="px-1 pb-1 text-[11px] text-red-300">
          {t("agencySwitcher.error")}
        </p>
      )}

      {canSwitch && open && !error && (
        <div
          role="menu"
          aria-label={t("agencySwitcher.label")}
          className="absolute left-3 right-3 top-full z-20 mt-1 overflow-hidden rounded-md border border-sidebar-border bg-sidebar-background shadow-lg"
        >
          {memberships.map((membership) => {
            const isCurrent = membership.agency.id === currentAgencyId;
            return (
              <button
                key={membership.id}
                type="button"
                role="menuitem"
                disabled={switchingId !== null || isCurrent}
                onClick={() => handleSwitch(membership)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-sidebar-accent/60 disabled:cursor-default disabled:opacity-100"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-sidebar-foreground">
                    {membership.agency.name}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {membership.roles.map((role) => (
                      <span
                        key={role}
                        className="max-w-full truncate whitespace-nowrap rounded bg-sidebar-accent px-1.5 py-0.5 text-[10px] text-sidebar-muted"
                      >
                        {roleLabel(role)}
                      </span>
                    ))}
                    {isCurrent && (
                      <span className="max-w-full truncate whitespace-nowrap rounded bg-sidebar-accent px-1.5 py-0.5 text-[10px] text-sidebar-foreground">
                        {t("agencySwitcher.current")}
                      </span>
                    )}
                  </span>
                </span>
                {isCurrent && (
                  <Icon name="check" className="h-4 w-4 shrink-0 text-sidebar-foreground" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
