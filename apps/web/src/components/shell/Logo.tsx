/**
 * Brewbase logo mark (FE-012): a geometric "B" (stem + two bowls) on a
 * rounded tile. Variants follow each surface's color scheme:
 * violet = main brand, emerald = Client Portal, dark/light = mono.
 */

const B_PATH =
  "M16.5 36.5 V11.5 M16.5 11.5 h8 a5.9 5.9 0 0 1 0 11.8 h-8 M16.5 23.3 h9.5 a6.6 6.6 0 0 1 0 13.2 h-9.5";

const VARIANTS = {
  violet: { from: "#8B74FF", to: "#6D4FE0", stroke: "#FFFFFF", ring: undefined as string | undefined },
  emerald: { from: "#10B981", to: "#047857", stroke: "#FFFFFF", ring: undefined as string | undefined },
  dark: { from: "#27272A", to: "#18181B", stroke: "#FFFFFF", ring: undefined as string | undefined },
  light: { from: "#FFFFFF", to: "#F4F4F5", stroke: "#18181B", ring: "#E4E4E7" as string | undefined },
};

export function Logo({
  variant = "violet",
  className = "h-8 w-8",
}: {
  variant?: keyof typeof VARIANTS;
  className?: string;
}) {
  const v = VARIANTS[variant];
  const gradientId = `brewbase-logo-${variant}`;
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="Brewbase">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={v.from} />
          <stop offset="1" stopColor={v.to} />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill={`url(#${gradientId})`} stroke={v.ring} strokeWidth={v.ring ? 1.5 : 0} />
      <path
        d={B_PATH}
        fill="none"
        stroke={v.stroke}
        strokeWidth="4.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
