"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Skeleton loading system (DEC-021, UI_GUIDELINES section 9).
 *
 * A skeleton is a geometric twin of the real content: same frame,
 * same heights, so data swaps in without layout shift. The pulse
 * animation only runs under motion-safe, so users who prefer
 * reduced motion get a static skeleton (DEC-021).
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`motion-safe:animate-pulse rounded bg-muted ${className}`} />;
}

/**
 * DEC-021 timing: a skeleton appears only when loading lasts
 * longer than ~200 ms (fast loads never flash a skeleton), and
 * once visible it stays for at least ~350 ms so it cannot blink.
 * Returns true while the skeleton should be on screen.
 */
export function useDelayedSkeleton(active: boolean, delayMs = 200, minMs = 350): boolean {
  const [show, setShow] = useState(false);
  const shownAtRef = useRef<number | null>(null);

  useEffect(() => {
    let showTimer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    if (active) {
      showTimer = setTimeout(() => {
        shownAtRef.current = Date.now();
        setShow(true);
      }, delayMs);
    } else if (shownAtRef.current !== null) {
      const elapsed = Date.now() - shownAtRef.current;
      const remain = Math.max(0, minMs - elapsed);
      hideTimer = setTimeout(() => {
        shownAtRef.current = null;
        setShow(false);
      }, remain);
    }

    return () => {
      if (showTimer) clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [active, delayMs, minMs]);

  return show;
}

/** Twin of a standard data card (list grid cell) while loading. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div aria-hidden className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-4 ${i === lines - 1 ? "w-1/2" : "w-5/6"}`} />
      ))}
    </div>
  );
}

/** A grid of card twins matching the list grids (sm:2, xl/lg:3). */
export function SkeletonCardGrid({ count = 6, variant = "xl3" }: { count?: number; variant?: "xl3" | "lg3" }) {
  return (
    <div aria-hidden className={`grid gap-4 sm:grid-cols-2 ${variant === "xl3" ? "xl:grid-cols-3" : "lg:grid-cols-3"}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
