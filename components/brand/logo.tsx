import Image from "next/image";

import { academy } from "@/lib/content/site";
import { cn } from "@/lib/utils";

/**
 * The academy's emblem with its name set beside it.
 *
 * The name is HTML text rather than part of the image on purpose. The supplied
 * artwork sets it in black with no outline, so a picture of it would vanish
 * against the dark colour scheme and would need a second, inverted copy kept in
 * step with the first. As text it recolours itself, stays selectable, scales
 * with the reader's font size, and needs no alternative description.
 *
 * Which leaves the emblem carrying no information the text does not, so it is
 * marked decorative — `alt=""` keeps a screen reader from announcing the
 * academy's name twice in a row.
 *
 * Deliberately not a link: it sits inside one on the public site and the sign-in
 * pages, but inside a plain heading in the dashboard sidebar, and nesting an
 * anchor inside an anchor is invalid.
 */
export function Logo({
  className,
  size = 36,
  /** Set on the pages where the logo is the largest thing above the fold. */
  priority = false,
}: {
  className?: string;
  size?: number;
  priority?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <Image
        src="/brand/rrba-mark.png"
        alt=""
        width={size}
        height={size}
        priority={priority}
        className="shrink-0"
      />
      <span className="text-sm font-semibold tracking-tight">
        {academy.shortName}
        <span className="block text-xs font-normal text-[var(--foreground-muted)]">
          Basketball Academy
        </span>
      </span>
    </span>
  );
}

/**
 * The emblem on its own, for decorative use on the brand surfaces.
 *
 * Separate from `Logo` because it carries no name to read: anywhere it appears,
 * the academy is already identified in the surrounding copy.
 */
export function LogoMark({
  className,
  size = 36,
  priority = false,
}: {
  className?: string;
  size?: number;
  priority?: boolean;
}) {
  return (
    <Image
      src="/brand/rrba-mark.png"
      alt=""
      width={size}
      height={size}
      priority={priority}
      className={cn("shrink-0", className)}
    />
  );
}
