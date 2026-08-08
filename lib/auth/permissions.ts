import type { AppRole } from "@/lib/supabase/types";

/**
 * Role definitions and permission helpers.
 *
 * This module is the single source of truth for what each role may do in the
 * UI. It mirrors — and never replaces — the RLS policies in the database:
 * these checks decide what to *render*, RLS decides what may be *read or
 * written*. A gap here is a cosmetic bug; a gap in RLS is a data breach.
 */

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  academy_admin: "Academy Admin",
  coach: "Coach",
  finance: "Finance",
  player: "Player",
  guardian: "Parent/Guardian",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  super_admin: "Full platform access, including user management and audit logs.",
  academy_admin: "Runs day-to-day academy operations.",
  coach: "Manages assigned teams, attendance, and player development.",
  finance: "Handles invoices, payments, and financial reporting.",
  player: "Views their own profile, schedule, and progress.",
  guardian: "Views their children's profiles, schedules, and fees.",
};

/** Staff roles see academy-wide navigation; player/guardian see a personal view. */
export const STAFF_ROLES: readonly AppRole[] = [
  "super_admin",
  "academy_admin",
  "coach",
  "finance",
];

export const ADMIN_ROLES: readonly AppRole[] = ["super_admin", "academy_admin"];

export function hasRole(roles: AppRole[], ...allowed: AppRole[]) {
  return roles.some((role) => allowed.includes(role));
}

export function isAdmin(roles: AppRole[]) {
  return roles.some((role) => ADMIN_ROLES.includes(role));
}

export function isStaff(roles: AppRole[]) {
  return roles.some((role) => STAFF_ROLES.includes(role));
}

/**
 * Medical records are restricted to admins and coaches. Finance staff need
 * billing data but must never see a child's medical history.
 */
export function canViewMedical(roles: AppRole[]) {
  return hasRole(roles, "super_admin", "academy_admin", "coach");
}

export function canManageFinance(roles: AppRole[]) {
  return hasRole(roles, "super_admin", "academy_admin", "finance");
}

/**
 * Finance permissions, mirroring the RLS policies.
 *
 * Invoices and payments are readable and writable by admins and the finance
 * role (invoices_admin_all / invoices_finance_*, payments_admin_all /
 * payments_finance_all). Coaches are deliberately excluded — they have no
 * reason to see what a family owes.
 *
 * Players and guardians can read their own invoices via invoices_self_read,
 * but that is a personal view rather than this staff-facing billing area.
 */
export function canViewFinance(roles: AppRole[]) {
  return canManageFinance(roles);
}

export function canRecordPayments(roles: AppRole[]) {
  return canManageFinance(roles);
}

/**
 * Reversing a confirmed payment rewrites what the academy believes it has
 * collected, so it is the one finance action limited to admins. RLS would
 * allow the finance role through (payments_finance_all); this narrows the UI
 * deliberately, and the action re-checks it.
 */
export function canReversePayments(roles: AppRole[]) {
  return isAdmin(roles);
}

/** fee_types insert/update allow admins and finance; only admins may delete. */
export function canManageFeeTypes(roles: AppRole[]) {
  return canManageFinance(roles);
}

/**
 * User administration.
 *
 * Both admin roles may activate accounts and grant the everyday roles, which
 * matches the user_roles RLS policies. Granting super_admin is narrower and
 * enforced by a database trigger, not just here — see canGrantRole.
 */
export function canManageUsers(roles: AppRole[]) {
  return isAdmin(roles);
}

/**
 * Whether the actor may grant or revoke a specific role.
 *
 * Only an existing super admin can create another one. Without this an
 * academy admin could promote themselves and take over the account. The
 * user_roles guard trigger enforces the same rule at the database, so this
 * check only decides what to render.
 */
export function canGrantRole(actorRoles: AppRole[], target: AppRole) {
  if (!isAdmin(actorRoles)) return false;
  if (target === "super_admin") return hasRole(actorRoles, "super_admin");
  return true;
}

export function canViewAuditLog(roles: AppRole[]) {
  return isAdmin(roles);
}

/**
 * Player record permissions, mirroring the RLS policies exactly.
 *
 * Creating a player is admin-only: the `players_admin_all` policy is the only
 * one granting insert. Coaches get `players_coach_update`, so they may edit
 * players on their own teams but cannot add new ones.
 */
export function canViewPlayers(roles: AppRole[]) {
  return hasRole(roles, "super_admin", "academy_admin", "coach");
}

export function canCreatePlayers(roles: AppRole[]) {
  return isAdmin(roles);
}

export function canEditPlayers(roles: AppRole[]) {
  return hasRole(roles, "super_admin", "academy_admin", "coach");
}

/**
 * Team permissions, mirroring the RLS policies.
 *
 * Every authenticated user can read teams (teams_read_authenticated), but
 * teams_admin_write/update/delete and the team_coaches policies are all
 * admin-only. Roster changes go through team_players_admin_all, so coaches
 * cannot move players between teams themselves.
 */
export function canViewTeams(roles: AppRole[]) {
  return isStaff(roles);
}

export function canManageTeams(roles: AppRole[]) {
  return isAdmin(roles);
}

export function canManageRoster(roles: AppRole[]) {
  return isAdmin(roles);
}

export function canAssignCoaches(roles: AppRole[]) {
  return isAdmin(roles);
}

export function canRecordAttendance(roles: AppRole[]) {
  return hasRole(roles, "super_admin", "academy_admin", "coach");
}

export function canAssessPlayers(roles: AppRole[]) {
  return hasRole(roles, "super_admin", "academy_admin", "coach");
}

/** The role whose dashboard a multi-role user lands on. */
const ROLE_PRIORITY: readonly AppRole[] = [
  "super_admin",
  "academy_admin",
  "finance",
  "coach",
  "guardian",
  "player",
];

export function primaryRole(roles: AppRole[]): AppRole | null {
  for (const role of ROLE_PRIORITY) {
    if (roles.includes(role)) return role;
  }
  return null;
}
