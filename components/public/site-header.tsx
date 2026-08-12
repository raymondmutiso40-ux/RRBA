import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { InstagramIcon } from "@/components/icons/instagram";
import { Button } from "@/components/ui/button";
import { instagram } from "@/lib/content/site";

/**
 * Header for every page on the public site.
 *
 * Lived inside the landing page until there was a second public page to share
 * it with. The section links are absolute (`/#programs`, not `#programs`) so
 * they still work from /coaches and /teams, where that section is not on the
 * page.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border-color)] bg-[var(--background)]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3.5">
        <Link href="/">
          <Logo priority />
        </Link>

        <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
          <NavLink href="/#programs">Programmes</NavLink>
          <NavLink href="/teams">Squads</NavLink>
          <NavLink href="/coaches">Coaches</NavLink>
          <a
            href={instagram.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden rounded-lg px-3 py-2 text-sm text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] lg:flex lg:items-center lg:gap-1.5"
          >
            <InstagramIcon className="size-3.5" />
            Gallery
          </a>
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm">Register</Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="hidden rounded-lg px-3 py-2 text-sm text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] sm:block"
    >
      {children}
    </Link>
  );
}
