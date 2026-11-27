import React from "react";

export function FlagIcon({ locale, className }: { locale: string; className?: string }) {
  if (locale === "vi") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="12" fill="#DA251D" />
        <path
          d="M12 6.2l1.35 2.73 3.01.44-2.18 2.12.51 3.0-2.69-1.41-2.69 1.41.51-3.0-2.18-2.12 3.01-.44z"
          fill="#FFC107"
        />
      </svg>
    );
  }
  // Union Jack (simplified)
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#012169" />
      <path d="M0 0h24v24H0z" fill="#012169" />
      {/* white diagonals */}
      <path d="M0 0L24 24M24 0L0 24" stroke="#FFFFFF" strokeWidth="4" />
      {/* red diagonals */}
      <path d="M0 0L24 24M24 0L0 24" stroke="#C8102E" strokeWidth="2" />
      {/* white cross */}
      <path d="M12 0v24M0 12h24" stroke="#FFFFFF" strokeWidth="6" />
      {/* red cross */}
      <path d="M12 0v24M0 12h24" stroke="#C8102E" strokeWidth="3.5" />
      <circle cx="12" cy="12" r="12" fill="none" stroke="#FFFFFF" strokeWidth="0.5" />
    </svg>
  );
}
