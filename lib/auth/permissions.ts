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

export function canManageUsers(roles: AppRole[]) {
  return hasRole(roles, "super_admin");
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
