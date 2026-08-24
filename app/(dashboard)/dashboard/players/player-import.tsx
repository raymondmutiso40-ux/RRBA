"use client";

import { useActionState, useRef } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { emptyPlayerActionState, type PlayerActionState } from "@/lib/players/action-state";
import { importPlayersCsvAction } from "@/lib/players/actions";

export function PlayerImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, formAction, isPending] = useActionState<PlayerActionState, FormData>(
    importPlayersCsvAction,
    emptyPlayerActionState,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import players</CardTitle>
        <CardDescription>
          Upload a CSV exported from Google Sheets. Name and phone number are required.
          Age and guardian are optional and are kept in the player notes.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {state.message ? (
          <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>
        ) : null}

        <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="player-csv" className="mb-1 block text-sm font-medium">
              Player CSV
            </label>
            <input
              ref={inputRef}
              id="player-csv"
              name="file"
              type="file"
              accept=".csv,text/csv"
              required
              className="block w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </div>
          <Button type="submit" loading={isPending}>
            {isPending ? "Importing..." : "Import players"}
          </Button>
        </form>

        <div className="text-xs text-[var(--foreground-muted)]">
          Accepted columns: <strong>Name, Age, Phone, Guardian</strong> or
          <strong> First Name, Last Name, Phone</strong>.
          <a
            href="/imports/rrba-players-template.csv"
            download
            className="ml-1 font-semibold text-[var(--primary)] hover:underline"
          >
            Download template
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
