import type { AppRole } from "@/lib/supabase/types";
import { hasRole } from "@/lib/auth/permissions";

export type NavItem = {
  label: string;
  href: string;
  /** Roles allowed to see this item. Empty means every signed-in user. */
  roles: AppRole[];
  /** Rendered when the destination has no page yet (M0). */
  comingSoon?: boolean;
};

export type NavSection = {
  heading: string;
  items: NavItem[];
};

/**
 * Sidebar navigation, filtered by role.
 *
 * Hiding a link is presentation only — the route itself and its data are
 * protected by middleware, server-side role guards, and RLS.
 */
const NAV_SECTIONS: NavSection[] = [
  {
    heading: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", roles: [] },
    ],
  },
  {
    heading: "Academy",
    items: [
      {
        label: "Players",
        href: "/dashboard/players",
        roles: ["super_admin", "academy_admin", "coach"],
      },
      {
        label: "Teams",
        href: "/dashboard/teams",
        roles: ["super_admin", "academy_admin", "coach"],
      },
      {
        label: "Coaches",
        href: "/dashboard/coaches",
        roles: ["super_admin", "academy_admin"],
        comingSoon: true,
      },
    ],
  },
  {
    heading: "Activity",
    items: [
      {
        label: "Training",
        href: "/dashboard/training",
        roles: ["super_admin", "academy_admin", "coach"],
        comingSoon: true,
      },
      {
        label: "Matches",
        href: "/dashboard/matches",
        roles: ["super_admin", "academy_admin", "coach"],
        comingSoon: true,
      },
      {
        label: "Attendance",
        href: "/dashboard/attendance",
        roles: ["super_admin", "academy_admin", "coach"],
        comingSoon: true,
      },
      {
        label: "Development",
        href: "/dashboard/development",
        roles: ["super_admin", "academy_admin", "coach"],
        comingSoon: true,
      },
    ],
  },
  {
    heading: "Finance",
    items: [
      {
        label: "Invoices",
        href: "/dashboard/invoices",
        roles: ["super_admin", "academy_admin", "finance"],
        comingSoon: true,
      },
      {
        label: "Payments",
        href: "/dashboard/payments",
        roles: ["super_admin", "academy_admin", "finance"],
        comingSoon: true,
      },
    ],
  },
  {
    heading: "My academy",
    items: [
      {
        label: "My profile",
        href: "/dashboard/me",
        roles: ["player", "guardian"],
        comingSoon: true,
      },
      {
        label: "My schedule",
        href: "/dashboard/my-schedule",
        roles: ["player", "guardian"],
        comingSoon: true,
      },
      {
        label: "My fees",
        href: "/dashboard/my-fees",
        roles: ["player", "guardian"],
        comingSoon: true,
      },
    ],
  },
  {
    heading: "Administration",
    items: [
      {
        label: "Users & roles",
        href: "/dashboard/users",
        roles: ["super_admin", "academy_admin"],
      },
      {
        label: "Applications",
        href: "/dashboard/applications",
        roles: ["super_admin", "academy_admin", "coach", "finance"],
      },
      {
        label: "Audit log",
        href: "/dashboard/audit",
        roles: ["super_admin", "academy_admin"],
      },
    ],
  },
];

export function navigationForRoles(roles: AppRole[]): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) => item.roles.length === 0 || hasRole(roles, ...item.roles),
    ),
  })).filter((section) => section.items.length > 0);
}
