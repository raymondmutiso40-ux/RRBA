"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

import { Input } from "@/components/ui/input";

/**
 * Invoice search.
 *
 * State lives in the URL so a filtered ledger is shareable and survives a
 * refresh, and the list itself stays a server component. The status tabs are
 * plain links on the page — only the free-text box needs client state.
 */
export function InvoiceFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drop a pending search navigation if the user leaves mid-debounce.
  useEffect(() => {
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, []);

  function apply(value: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (value) {
      params.set("search", value);
    } else {
      params.delete("search");
    }

    startTransition(() => {
      router.push(`/dashboard/invoices?${params.toString()}`);
    });
  }

  return (
    <div className="max-w-sm" aria-busy={isPending}>
      <Input
        name="search"
        type="search"
        label="Search"
        placeholder="Invoice number or player name"
        defaultValue={searchParams.get("search") ?? ""}
        onChange={(event) => {
          const { value } = event.currentTarget;
          // Debounce so each keystroke does not trigger a navigation.
          if (debounce.current) clearTimeout(debounce.current);
          debounce.current = setTimeout(() => apply(value.trim()), 300);
        }}
      />
    </div>
  );
}
