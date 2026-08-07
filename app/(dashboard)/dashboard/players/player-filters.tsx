"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  PLAYER_STATUSES,
  PLAYER_STATUS_LABELS,
  POSITIONS,
  POSITION_LABELS,
} from "@/lib/players/labels";

/**
 * Roster filters.
 *
 * State lives in the URL rather than component state so a filtered roster is
 * shareable, survives refresh, and keeps the list itself a server component.
 */
export function PlayerFilters() {
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

  function apply(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    // Any filter change invalidates the current page offset.
    params.delete("page");

    startTransition(() => {
      router.push(`/dashboard/players?${params.toString()}`);
    });
  }

  return (
    <div
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      aria-busy={isPending}
    >
      <Input
        name="search"
        type="search"
        label="Search"
        placeholder="Name, email, or phone"
        defaultValue={searchParams.get("search") ?? ""}
        onChange={(event) => {
          const { value } = event.currentTarget;
          // Debounce so each keystroke does not trigger a navigation.
          if (debounce.current) clearTimeout(debounce.current);
          debounce.current = setTimeout(() => apply("search", value), 300);
        }}
      />

      <Select
        name="status"
        label="Status"
        defaultValue={searchParams.get("status") ?? "all"}
        onChange={(event) => apply("status", event.currentTarget.value)}
      >
        <option value="all">All statuses</option>
        {PLAYER_STATUSES.map((status) => (
          <option key={status} value={status}>
            {PLAYER_STATUS_LABELS[status]}
          </option>
        ))}
      </Select>

      <Select
        name="position"
        label="Position"
        defaultValue={searchParams.get("position") ?? "all"}
        onChange={(event) => apply("position", event.currentTarget.value)}
      >
        <option value="all">All positions</option>
        {POSITIONS.map((position) => (
          <option key={position} value={position}>
            {POSITION_LABELS[position]}
          </option>
        ))}
      </Select>

      <Select
        name="sort"
        label="Sort by"
        defaultValue={searchParams.get("sort") ?? "name"}
        onChange={(event) => apply("sort", event.currentTarget.value)}
      >
        <option value="name">Name (A–Z)</option>
        <option value="recent">Recently added</option>
        <option value="status">Status</option>
        <option value="age">Age (youngest first)</option>
      </Select>
    </div>
  );
}
