/**
 * Default user avatar (FE-012): the initial of the person's LAST name
 * word (Vietnamese name order: the given name comes last) on a colored
 * disc. The color is picked deterministically from a palette by the
 * user's id (or name), so the same person always gets the same color —
 * it makes people recognizable next to small names in lists.
 */

const PALETTE = [
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-indigo-100 text-indigo-700",
  "bg-teal-100 text-teal-700",
  "bg-orange-100 text-orange-700",
];

function hashSeed(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function Avatar({
  name,
  seed,
  className = "h-8 w-8 text-xs",
}: {
  name: string;
  seed?: string | number;
  className?: string;
}) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const lastWord = words[words.length - 1] ?? "?";
  const initial = lastWord.charAt(0).toUpperCase();
  const color = PALETTE[hashSeed(String(seed ?? name)) % PALETTE.length];

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${color} ${className}`}
    >
      {initial}
    </span>
  );
}
