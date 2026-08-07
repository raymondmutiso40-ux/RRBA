import type {
  BasketballPosition,
  Gender,
  PlayerStatus,
} from "@/lib/supabase/types";

/** Display labels for player enums. Single source for tables, forms, filters. */

export const PLAYER_STATUS_LABELS: Record<PlayerStatus, string> = {
  applicant: "Applicant",
  active: "Active",
  inactive: "Inactive",
  graduated: "Graduated",
  withdrawn: "Withdrawn",
};

export const POSITION_LABELS: Record<BasketballPosition, string> = {
  point_guard: "Point Guard",
  shooting_guard: "Shooting Guard",
  small_forward: "Small Forward",
  power_forward: "Power Forward",
  center: "Center",
};

/** Short forms for narrow table columns. */
export const POSITION_ABBR: Record<BasketballPosition, string> = {
  point_guard: "PG",
  shooting_guard: "SG",
  small_forward: "SF",
  power_forward: "PF",
  center: "C",
};

export const GENDER_LABELS: Record<Gender, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
  undisclosed: "Prefer not to say",
};

export const DOMINANT_HAND_LABELS: Record<string, string> = {
  left: "Left",
  right: "Right",
  ambidextrous: "Ambidextrous",
};

export const BLOOD_GROUPS = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
] as const;

export const PLAYER_STATUSES = Object.keys(
  PLAYER_STATUS_LABELS,
) as PlayerStatus[];

export const POSITIONS = Object.keys(POSITION_LABELS) as BasketballPosition[];

export const GENDERS = Object.keys(GENDER_LABELS) as Gender[];

/** Badge tone per status, so the roster reads at a glance. */
export function statusTone(
  status: PlayerStatus,
): "success" | "warning" | "neutral" | "info" {
  switch (status) {
    case "active":
      return "success";
    case "applicant":
      return "warning";
    case "graduated":
      return "info";
    default:
      return "neutral";
  }
}

export function playerFullName(player: {
  first_name: string;
  last_name: string;
}) {
  return `${player.first_name} ${player.last_name}`.trim();
}
