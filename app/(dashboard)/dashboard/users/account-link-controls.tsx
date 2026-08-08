"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { linkAccountAction, unlinkAccountAction } from "@/lib/identity/actions";
import {
  emptyIdentityActionState,
  type IdentityActionState,
} from "@/lib/identity/action-state";
import type { LinkCandidate, LinkedRecord } from "@/lib/identity/queries";

/**
 * Connects a login to the academy record it belongs to.
 *
 * Deliberately a decision rather than an inference. An email match is shown as
 * a suggestion because it is the strongest signal available, but the address on
 * a guardian record came from whoever filled in the application — so an admin
 * confirms before anything is linked, and the consequence is spelled out on the
 * button rather than buried in a help page.
 */
export function AccountLinkControls({
  userId,
  email,
  linked,
  candidates,
  searchTerm,
}: {
  userId: string;
  email: string;
  linked: LinkedRecord | null;
  candidates: LinkCandidate[];
  searchTerm: string;
}) {
  const [linkState, linkAction, linking] = useActionState<
    IdentityActionState,
    FormData
  >(linkAccountAction, emptyIdentityActionState);

  const [unlinkState, unlinkAction, unlinking] = useActionState<
    IdentityActionState,
    FormData
  >(unlinkAccountAction, emptyIdentityActionState);

  const feedback = linkState.message ? linkState : unlinkState;

  return (
    <div className="flex flex-col gap-4">
      {feedback.message ? (
        <Alert tone={feedback.ok ? "success" : "danger"}>
          {feedback.message}
        </Alert>
      ) : null}

      {linked ? (
        <div className="flex flex-col gap-3 rounded-lg border border-[var(--border-color)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">
                {linked.name}
                <Badge
                  tone={linked.kind === "guardian" ? "info" : "brand"}
                  className="ml-2"
                >
                  {linked.kind === "guardian" ? "Guardian" : "Player"}
                </Badge>
              </p>
              <p className="mt-1 text-xs text-[var(--foreground-muted)]">
                {linked.kind === "guardian"
                  ? linked.children.length === 0
                    ? "Not linked to any child yet, so there is nothing for them to see."
                    : `Sees: ${linked.children.map((child) => child.name).join(", ")}`
                  : "Sees their own profile, schedule, and fees."}
              </p>
            </div>

            <form action={unlinkAction}>
              <input type="hidden" name="userId" value={userId} />
              <input type="hidden" name="kind" value={linked.kind} />
              <input type="hidden" name="recordId" value={linked.id} />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                loading={unlinking}
                disabled={linking}
              >
                Unlink
              </Button>
            </form>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[var(--foreground-muted)]">
          Not linked. This account can sign in, but the database cannot tell
          which player or family it belongs to, so their own pages will be
          empty.
        </p>
      )}

      {!linked ? (
        <>
          <form
            action={`/dashboard/users/${userId}`}
            method="get"
            className="flex flex-wrap items-end gap-3"
          >
            <div className="min-w-56 flex-1">
              <Input
                name="link"
                type="search"
                label="Search records"
                placeholder="Name or phone"
                defaultValue={searchTerm}
                hint={`Showing records matching ${email} until you search.`}
              />
            </div>
            <Button type="submit" variant="outline">
              Search
            </Button>
          </form>

          {candidates.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--border-color)] p-4 text-center text-sm text-[var(--foreground-muted)]">
              {searchTerm
                ? "No unlinked records match that search."
                : "No unlinked record carries this email address. Search by name to find the right one."}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {candidates.map((candidate) => (
                <li
                  key={`${candidate.kind}:${candidate.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border-color)] p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {candidate.name}
                      <Badge
                        tone={candidate.kind === "guardian" ? "info" : "brand"}
                        className="ml-2"
                      >
                        {candidate.kind === "guardian" ? "Guardian" : "Player"}
                      </Badge>
                      {candidate.isEmailMatch ? (
                        <Badge tone="success" className="ml-1.5">
                          Email matches
                        </Badge>
                      ) : null}
                    </p>
                    {candidate.detail ? (
                      <p className="mt-0.5 text-xs text-[var(--foreground-muted)]">
                        {candidate.detail}
                      </p>
                    ) : null}
                  </div>

                  <form action={linkAction}>
                    <input type="hidden" name="userId" value={userId} />
                    <input type="hidden" name="kind" value={candidate.kind} />
                    <input type="hidden" name="recordId" value={candidate.id} />
                    <Button
                      type="submit"
                      size="sm"
                      variant="outline"
                      loading={linking}
                      disabled={unlinking}
                    >
                      Link as {candidate.kind}
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}
