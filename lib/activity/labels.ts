import type { AttendanceStatus, EventStatus } from "@/lib/supabase/types";

/**
 * Display labels for the activity enums.
 *
 * Training sessions and matches share the events table, so everything here is
 * written to serve both — but this milestone only builds the training views,
 * and every query filters on event_type = 'training'.
 */

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  late: "Late",
  excused: "Excused",
  absent: "Absent",
};

/** Order the register offers them: the common answer first. */
export const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  "present",
  "late",
  "excused",
  "absent",
];

export function eventStatusTone(
  status: EventStatus,
): "success" | "brand" | "neutral" {
  if (status === "completed") return "success";
  if (status === "cancelled") return "neutral";
  return "brand";
}

export function attendanceStatusTone(
  status: AttendanceStatus,
): "success" | "warning" | "danger" | "neutral" {
  if (status === "present") return "success";
  if (status === "late") return "warning";
  if (status === "absent") return "danger";
  return "neutral";
}

/**
 * Which slice of the calendar a list is showing.
 *
 * Declared here rather than in queries.ts so the filter links can import it
 * without reaching into server-only code.
 */
export type SessionFilter = "upcoming" | "past" | "unmarked" | "all";

export const SESSION_FILTER_LABELS: Record<SessionFilter, string> = {
  upcoming: "Upcoming",
  past: "Past",
  unmarked: "Needs a register",
  all: "All",
};

export const SESSION_FILTERS: SessionFilter[] = [
  "upcoming",
  "unmarked",
  "past",
  "all",
];

export function isSessionFilter(
  value: string | undefined,
): value is SessionFilter {
  return value !== undefined && value in SESSION_FILTER_LABELS;
}

/** "1h 30m" — sessions are short enough that hours and minutes is enough. */
export function formatDuration(startsAt: string, endsAt: string): string {
  const minutes = Math.round(
    (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000,
  );

  if (minutes <= 0) return "—";
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

/** Time of day only, for a list already grouped by date. */
export function formatTime(value: string): string {
  return new Intl.DateTimeFormat("en-KE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

/**
 * Share of sessions a player actually turned up to.
 *
 * Late counts as attended — they were there — while excused is left out of the
 * denominator entirely, since an approved absence should not read as a poor
 * attendance record.
 */
export function attendanceRate(counts: {
  present: number;
  late: number;
  absent: number;
  excused: number;
}): number | null {
  const counted = counts.present + counts.late + counts.absent;
  if (counted === 0) return null;
  return (counts.present + counts.late) / counted;
}

export function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

export function rateTone(
  rate: number | null,
): "success" | "warning" | "danger" | "neutral" {
  if (rate === null) return "neutral";
  if (rate >= 0.85) return "success";
  if (rate >= 0.6) return "warning";
  return "danger";
}
