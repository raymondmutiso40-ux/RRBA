import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";

type AuditInput = {
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Appends an entry to the audit trail.
 *
 * The actor is read from the session rather than passed in, so a call site
 * cannot attribute an action to somebody else.
 *
 * Failures are swallowed deliberately. An audit write must never turn a
 * successful operation into a visible error — the user's change already
 * happened, and telling them it failed would be wrong. audit_log is
 * append-only at the database (insert policy, no update or delete), so the
 * trail cannot be rewritten from the application.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    const user = await getSessionUser();
    const supabase = await createClient();

    await supabase.from("audit_log").insert({
      actor_id: user?.id ?? null,
      action: input.action,
      entity: input.entity,
      entity_id: input.entityId ?? null,
      metadata: input.metadata ?? {},
    });
  } catch {
    // Intentionally ignored — see above.
  }
}
