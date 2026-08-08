"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  grantRoleAction,
  revokeRoleAction,
  setAccountStatusAction,
} from "@/lib/admin/actions";
import {
  emptyAdminActionState,
  type AdminActionState,
} from "@/lib/admin/action-state";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/auth/permissions";
import type { AccountStatus, AppRole } from "@/lib/supabase/types";

type RoleGrant = { id: string; role: AppRole };

/**
 * Role and status controls for one account.
 *
 * `grantable` is decided on the server: only a super admin sees super_admin in
 * the list. The same rule is enforced by a database trigger, so hiding it here
 * is presentation, not protection.
 */
export function UserRoleControls({
  userId,
  grants,
  grantable,
  status,
  statuses,
  isSelf,
  isLastSuperAdmin,
}: {
  userId: string;
  grants: RoleGrant[];
  grantable: AppRole[];
  status: AccountStatus;
  statuses: readonly AccountStatus[];
  isSelf: boolean;
  isLastSuperAdmin: boolean;
}) {
  const [grantState, grant, granting] = useActionState<
    AdminActionState,
    FormData
  >(grantRoleAction, emptyAdminActionState);

  const [revokeState, revoke, revoking] = useActionState<
    AdminActionState,
    FormData
  >(revokeRoleAction, emptyAdminActionState);

  const [statusState, changeStatus, changingStatus] = useActionState<
    AdminActionState,
    FormData
  >(setAccountStatusAction, emptyAdminActionState);

  const feedback = grantState.message
    ? grantState
    : revokeState.message
      ? revokeState
      : statusState;

  const busy = granting || revoking || changingStatus;
  const available = grantable.filter(
    (role) => !grants.some((g) => g.role === role),
  );

  return (
    <div className="flex flex-col gap-6">
      {feedback.message ? (
        <Alert tone={feedback.ok ? "success" : "danger"}>
          {feedback.message}
        </Alert>
      ) : null}

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Roles</h3>

        {grants.length === 0 ? (
          <p className="text-sm text-[var(--foreground-muted)]">
            No roles granted. This account cannot access academy data yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {grants.map((granted) => {
              const canRevoke = grantable.includes(granted.role);
              const blocksLockout =
                granted.role === "super_admin" && isLastSuperAdmin;

              return (
                <li
                  key={granted.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border-color)] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {ROLE_LABELS[granted.role]}
                    </p>
                    <p className="text-xs text-[var(--foreground-muted)]">
                      {ROLE_DESCRIPTIONS[granted.role]}
                    </p>
                  </div>

                  {canRevoke && !blocksLockout ? (
                    <form action={revoke}>
                      <input type="hidden" name="userId" value={userId} />
                      <input type="hidden" name="roleId" value={granted.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                      >
                        Revoke
                      </Button>
                    </form>
                  ) : (
                    <span className="text-xs text-[var(--foreground-muted)]">
                      {blocksLockout
                        ? "Last super admin"
                        : "Super admin only"}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {available.length > 0 ? (
          <form action={grant} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="userId" value={userId} />
            <div className="min-w-56 flex-1">
              <Select name="role" label="Grant a role" required>
                <option value="">Select a role</option>
                {available.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" loading={granting} disabled={busy}>
              Grant
            </Button>
          </form>
        ) : null}
      </section>

      <section className="flex flex-col gap-3 border-t border-[var(--border-color)] pt-5">
        <h3 className="text-sm font-semibold">Account status</h3>
        <p className="text-sm text-[var(--foreground-muted)]">
          A pending account can sign in but reaches nothing until it is active.
          Suspending revokes access without deleting the record.
        </p>

        <form action={changeStatus} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="userId" value={userId} />
          <div className="min-w-48">
            <Select name="status" label="Status" defaultValue={status}>
              {statuses.map((option) => (
                <option key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </option>
              ))}
            </Select>
          </div>
          <Button
            type="submit"
            variant="outline"
            loading={changingStatus}
            disabled={busy}
          >
            Update status
          </Button>
        </form>

        {isSelf ? (
          <Alert tone="warning">
            This is your own account. Suspending it or removing your admin role
            will end your own access.
          </Alert>
        ) : null}
      </section>
    </div>
  );
}
