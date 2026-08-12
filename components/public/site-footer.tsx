import Link from "next/link";

import { InstagramIcon } from "@/components/icons/instagram";
import { academy, instagram } from "@/lib/content/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border-color)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">{academy.name}</p>
          <p className="mt-1 text-sm text-[var(--foreground-muted)]">
            © {new Date().getFullYear()} · {academy.location}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <a
            href={instagram.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-[var(--foreground-muted)] transition-colors hover:text-[var(--primary)]"
          >
            <InstagramIcon className="size-4" />
            {instagram.handle}
          </a>
          <Link
            href="/login"
            className="text-sm text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]"
          >
            Member sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}
