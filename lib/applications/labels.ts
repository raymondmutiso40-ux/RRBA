import type { ApplicationStatus } from "@/lib/supabase/types";

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: "Pending review",
  approved: "Approved",
  declined: "Declined",
  withdrawn: "Withdrawn",
};

export function applicationStatusTone(
  status: ApplicationStatus,
): "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "approved":
      return "success";
    case "pending":
      return "warning";
    case "declined":
      return "danger";
    default:
      return "neutral";
  }
}

/** Programmes offered on the public form. Mirrors lib/content/site.ts. */
export const PROGRAM_OPTIONS = [
  "Mini Ballers (6–9)",
  "Development Squad (10–13)",
  "Elite Programme (14–18)",
  "Holiday Clinics",
  "Not sure yet",
] as const;

export const RELATIONSHIP_OPTIONS = [
  "parent",
  "guardian",
  "grandparent",
  "sibling",
  "other",
] as const;

export const HEARD_ABOUT_OPTIONS = [
  "Instagram",
  "Word of mouth",
  "School",
  "Saw a session",
  "Other",
] as const;

export function applicantFullName(application: {
  player_first_name: string;
  player_last_name: string;
}) {
  return `${application.player_first_name} ${application.player_last_name}`.trim();
}
