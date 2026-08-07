import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Runda Ridge Basketball Academy",
    template: "%s · RRBA",
  },
  description:
    "Runda Ridge Basketball Academy develops young basketball players through " +
    "structured coaching, competitive play, and personal development.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* Lets keyboard users jump past the nav on every page. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-[var(--primary)] focus:px-4 focus:py-2 focus:text-[var(--primary-foreground)]"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
