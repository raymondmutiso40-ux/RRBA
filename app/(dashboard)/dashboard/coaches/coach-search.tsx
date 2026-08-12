"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

import { Input } from "@/components/ui/input";

/**
 * Coach search.
 *
 * State lives in the URL so the list itself stays a server component and a
 * filtered view survives a refresh. Same shape as the invoice search — the
 * shared Input needs a client component because it calls useId.
 */
export function CoachSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    const query = params.toString();
    startTransition(() => {
      router.push(query ? `/dashboard/coaches?${query}` : "/dashboard/coaches");
    });
  }

  return (
    <div className="max-w-sm" aria-busy={isPending}>
      <Input
        name="search"
        type="search"
        label="Search"
        placeholder="Name or email"
        defaultValue={searchParams.get("search") ?? ""}
        onChange={(event) => {
          const { value } = event.currentTarget;
          if (debounce.current) clearTimeout(debounce.current);
          debounce.current = setTimeout(() => apply(value.trim()), 300);
        }}
      />
    </div>
  );
}
