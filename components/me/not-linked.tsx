import { EmptyState } from "@/components/ui/empty-state";

/**
 * Shown when an account has no player or guardian record behind it.
 *
 * Worth being plain about rather than showing an empty table: nothing is broken
 * and the person has done nothing wrong — the academy simply has not connected
 * their login to their family yet, and only an administrator can do it.
 */
export function NotLinked({ what }: { what: string }) {
  return (
    <EmptyState
      title="Your account is not connected yet"
      description={`Your login works, but it has not been matched to your family's records, so there is no ${what} to show. An academy administrator needs to connect them — ask them to link your account, and this page will fill in.`}
    />
  );
}

/** Linked as a guardian, but no children are attached to that record. */
export function NoChildren() {
  return (
    <EmptyState
      title="No children on your record"
      description="Your account is connected, but no player is linked to it yet. An academy administrator can attach your children to your guardian record."
    />
  );
}
