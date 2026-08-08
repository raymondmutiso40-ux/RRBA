import { z } from "zod";

/**
 * Shared validation schemas.
 *
 * Every schema is used on both sides: the browser validates as the user
 * types, and the server re-validates the same schema before touching the
 * database. Trusting client-side validation alone would let anyone POST
 * arbitrary data straight to Supabase.
 *
 * The mirror-comments reference the Postgres columns each schema validates.
 */

// ---------------------------------------------------------------------------
// Identity & auth
// ---------------------------------------------------------------------------

export const authSignUpSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z
    .string()
    .min(8, "At least 8 characters")
    .max(128)
    .regex(/[A-Za-z]/, "Include at least one letter")
    .regex(/[0-9]/, "Include at least one number"),
  fullName: z.string().trim().min(2).max(160),
});

export const authLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, "Enter your password").max(128),
});

export const authRequestResetSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const authUpdatePasswordSchema = z.object({
  password: z
    .string()
    .min(8, "At least 8 characters")
    .max(128)
    .regex(/[A-Za-z]/, "Include at least one letter")
    .regex(/[0-9]/, "Include at least one number"),
});

export const profileUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(160).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
});

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export const playerSchema = z.object({
  // players
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD")
    .refine((value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(date.getTime());
    }, "Invalid date"),
  gender: z.enum(["male", "female", "other", "undisclosed"]),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  position: z
    .enum(["point_guard", "shooting_guard", "small_forward", "power_forward", "center"])
    .optional()
    .nullable(),
  jerseyNumber: z
    .number()
    .int()
    .min(0)
    .max(99)
    .optional()
    .nullable(),
  heightCm: z.number().int().min(80).max(260).optional().nullable(),
  weightKg: z.number().min(20).max(300).optional().nullable(),
  dominantHand: z.enum(["left", "right", "ambidextrous"]).optional().nullable(),
  status: z.enum(["applicant", "active", "inactive", "graduated", "withdrawn"]).optional(),
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
});

export const guardianSchema = z.object({
  // guardians
  fullName: z.string().trim().min(2).max(160),
  relationship: z.string().trim().min(2).max(50),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number"),
  altPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  occupation: z.string().trim().max(160).optional().or(z.literal("")),
  isEmergencyContact: z.boolean().optional(),
});

export const playerMedicalSchema = z.object({
  // player_medical
  bloodGroup: z
    .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])
    .optional()
    .nullable(),
  allergies: z.string().trim().max(2000).optional().or(z.literal("")),
  chronicConditions: z.string().trim().max(2000).optional().or(z.literal("")),
  medications: z.string().trim().max(2000).optional().or(z.literal("")),
  dietaryRequirements: z.string().trim().max(2000).optional().or(z.literal("")),
  insuranceProvider: z.string().trim().max(200).optional().or(z.literal("")),
  insuranceNumber: z.string().trim().max(100).optional().or(z.literal("")),
  doctorName: z.string().trim().max(160).optional().or(z.literal("")),
  doctorPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
  emergencyContactName: z.string().trim().max(160).optional().or(z.literal("")),
  emergencyContactPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
  lastPhysicalOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD")
    .optional()
    .nullable(),
  clearedToPlay: z.boolean().optional(),
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
});

// ---------------------------------------------------------------------------
// Teams & coaches
// ---------------------------------------------------------------------------

export const teamSchema = z.object({
  // teams
  name: z.string().trim().min(1).max(120),
  ageGroup: z.string().trim().min(1).max(80),
  gender: z.enum(["male", "female", "other", "undisclosed"]),
  seasonId: z.string().uuid().optional().nullable(),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  minAge: z.number().int().min(4).max(30).optional().nullable(),
  maxAge: z.number().int().min(4).max(30).optional().nullable(),
  isActive: z.boolean().optional(),
})
  // Mirrors the teams_age_range CHECK constraint, so an impossible range is
  // rejected in the form rather than as a database error.
  .refine(
    (v) => v.minAge == null || v.maxAge == null || v.maxAge >= v.minAge,
    { message: "Maximum age must not be below minimum age", path: ["maxAge"] },
  );

/** Adding a player to a team's roster. */
export const rosterAddSchema = z.object({
  teamId: z.string().uuid(),
  playerId: z.string().uuid("Select a player"),
});

/** Ending a player's spell with a team. */
export const rosterRemoveSchema = z.object({
  teamId: z.string().uuid(),
  membershipId: z.string().uuid(),
});

/** Assigning a coach to a team. */
export const coachAssignSchema = z.object({
  teamId: z.string().uuid(),
  coachId: z.string().uuid("Select a coach"),
  isLead: z.boolean().optional(),
});

export const coachUnassignSchema = z.object({
  teamId: z.string().uuid(),
  assignmentId: z.string().uuid(),
});

export const seasonSchema = z.object({
  // seasons
  name: z.string().trim().min(1).max(120),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  isCurrent: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

export const eventSchema = z.object({
  // events
  eventType: z.enum(["training", "match"]),
  teamId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  startsAt: z.string().min(1, "Required"),
  endsAt: z.string().min(1, "Required"),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
  coachId: z.string().uuid().optional().nullable(),
  // match-only
  opponent: z.string().trim().max(120).optional().or(z.literal("")),
  competition: z.string().trim().max(200).optional().or(z.literal("")),
  isHome: z.boolean().optional().nullable(),
  finalScoreTeam: z.number().int().min(0).optional().nullable(),
  finalScoreOpp: z.number().int().min(0).optional().nullable(),
  result: z.enum(["win", "loss", "draw"]).optional().nullable(),
});

/**
 * A training session.
 *
 * Narrower than eventSchema, which has to cover matches too: a session has no
 * opponent or scoreline, and its team is required rather than optional. RLS
 * refuses a coach any event with a null team_id (events_coach_write), so making
 * the field optional here would only produce a confusing database error for the
 * most common author of a session.
 */
export const trainingSessionSchema = z
  .object({
    // events, filtered to event_type = 'training'
    teamId: z.string().uuid("Choose a team").optional().nullable(),
    title: z.string().trim().min(1, "Required").max(200),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
    startsAt: z.string().min(1, "Required"),
    endsAt: z.string().min(1, "Required"),
    location: z.string().trim().max(200).optional().or(z.literal("")),
    coachId: z.string().uuid().optional().nullable(),
    status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
  })
  // Mirrors the events_time_order CHECK constraint.
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), {
    message: "The session must end after it starts",
    path: ["endsAt"],
  });

export const sessionStatusSchema = z.object({
  eventId: z.string().uuid(),
  status: z.enum(["scheduled", "completed", "cancelled"]),
});

/**
 * One player's mark on a register.
 *
 * The register submits every row at once, so this validates a single entry and
 * the action maps it over the form's parallel arrays.
 */
export const attendanceMarkSchema = z.object({
  playerId: z.string().uuid(),
  status: z.enum(["present", "absent", "late", "excused"]),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const callUpSchema = z.object({
  eventId: z.string().uuid(),
  playerId: z.string().uuid("Select a player"),
});

export const playerMatchStatsSchema = z.object({
  // player_match_stats
  eventId: z.string().uuid(),
  playerId: z.string().uuid(),
  minutesPlayed: z.number().int().min(0).optional().nullable(),
  points: z.number().int().min(0).optional().nullable(),
  rebounds: z.number().int().min(0).optional().nullable(),
  assists: z.number().int().min(0).optional().nullable(),
  steals: z.number().int().min(0).optional().nullable(),
  blocks: z.number().int().min(0).optional().nullable(),
  turnovers: z.number().int().min(0).optional().nullable(),
  fouls: z.number().int().min(0).optional().nullable(),
  fgAttempts: z.number().int().min(0).optional().nullable(),
  fgMade: z.number().int().min(0).optional().nullable(),
  threeAttempts: z.number().int().min(0).optional().nullable(),
  threeMade: z.number().int().min(0).optional().nullable(),
  ftAttempts: z.number().int().min(0).optional().nullable(),
  ftMade: z.number().int().min(0).optional().nullable(),
});

// ---------------------------------------------------------------------------
// Finance
// ---------------------------------------------------------------------------

export const feeTypeSchema = z.object({
  // fee_types
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  amount: z.number().positive().max(10_000_000),
  currency: z.string().length(3).toUpperCase().default("KES"),
  interval: z.enum(["one_time", "monthly", "termly", "annual"]),
  isActive: z.boolean().optional(),
});

export const feeTypeToggleSchema = z.object({
  feeTypeId: z.string().uuid(),
  isActive: z.boolean(),
});

export const invoiceSchema = z.object({
  // invoices
  playerId: z.string().uuid(),
  feeTypeId: z.string().uuid().optional().nullable(),
  description: z.string().trim().min(1).max(1000),
  amountDue: z.number().positive().max(10_000_000),
  currency: z.string().length(3).toUpperCase().default("KES"),
  periodStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD")
    .optional()
    .nullable(),
  periodEnd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD")
    .optional()
    .nullable(),
  issuedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD")
    .optional(),
  dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
})
  // Mirrors the invoices_period_order CHECK constraint.
  .refine(
    (v) => !v.periodStart || !v.periodEnd || v.periodEnd >= v.periodStart,
    { message: "Period end must not be before the start", path: ["periodEnd"] },
  );

/** Issuing or voiding an invoice — the whole payload is the invoice itself. */
export const invoiceActionSchema = z.object({
  invoiceId: z.string().uuid(),
});

/**
 * Voiding carries a reason. An invoice is a document the family has seen, so
 * cancelling one is a decision worth being able to explain later; the reason
 * goes to the audit log.
 */
export const invoiceVoidSchema = z.object({
  invoiceId: z.string().uuid(),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

export const paymentRecordSchema = z.object({
  // payments — recorded manually (cash, bank transfer, …)
  invoiceId: z.string().uuid(),
  amount: z.number().positive().max(10_000_000),
  currency: z.string().length(3).toUpperCase().default("KES"),
  method: z.enum(["cash", "mpesa", "bank_transfer", "cheque", "card", "other"]),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  reference: z.string().trim().max(200).optional().or(z.literal("")),
  payerName: z.string().trim().max(160).optional().or(z.literal("")),
  payerPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  /** Cash in hand is confirmed on the spot; a promised transfer is pending. */
  isConfirmed: z.boolean().optional(),
});

/**
 * Changing where a payment sits in its lifecycle.
 *
 * 'pending' is absent on purpose: a payment starts there and never returns,
 * because re-opening a settled receipt would silently move the invoice
 * balance back. The action enforces which transitions are legal.
 */
export const paymentStateSchema = z.object({
  paymentId: z.string().uuid(),
  state: z.enum(["confirmed", "failed", "reversed"]),
});

export const contactSubmissionSchema = z.object({
  // contact_submissions — public form
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().toLowerCase().email(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
  subject: z.string().trim().max(200).optional().or(z.literal("")),
  message: z.string().trim().min(10).max(4000),
  playerAge: z.number().int().min(3).max(30).optional().nullable(),
  isApplication: z.boolean().optional(),
});

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number");

/**
 * Public enrolment application — the one form an anonymous visitor can submit.
 *
 * Limits mirror the CHECK constraints on the applications table exactly, so a
 * payload that passes here cannot be rejected by the database, and one that
 * bypasses the form still hits the same ceiling.
 */
export const applicationSchema = z.object({
  // applications — child
  playerFirstName: z.string().trim().min(1, "Required").max(100),
  playerLastName: z.string().trim().min(1, "Required").max(100),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker")
    .refine((value) => {
      const date = new Date(`${value}T00:00:00Z`);
      if (Number.isNaN(date.getTime())) return false;
      // Matches applications_dob_sane.
      return date < new Date() && date > new Date("1950-01-01T00:00:00Z");
    }, "Enter a valid date of birth"),
  gender: z.enum(["male", "female", "other", "undisclosed"]),
  position: z
    .enum([
      "point_guard",
      "shooting_guard",
      "small_forward",
      "power_forward",
      "center",
    ])
    .optional()
    .nullable(),
  school: optionalText(200),
  previousExperience: optionalText(2000),

  // applications — guardian
  guardianName: z.string().trim().min(2, "Required").max(160),
  guardianRelationship: z.string().trim().min(2).max(50),
  guardianPhone: phone,
  guardianEmail: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  guardianAltPhone: phone.optional().or(z.literal("")),

  // applications — intent
  programInterest: optionalText(200),
  medicalNotes: optionalText(2000),
  heardAboutUs: optionalText(200),
});

/** Staff decision on an application. */
export const applicationReviewSchema = z.object({
  applicationId: z.string().uuid(),
  teamId: z.string().uuid().optional().nullable(),
  reviewNotes: optionalText(2000),
});

// ---------------------------------------------------------------------------
// User administration
// ---------------------------------------------------------------------------

/**
 * Role names, mirroring the app_role database enum. Kept as a literal tuple so
 * a role added to the enum without updating this list is a type error rather
 * than a silent validation gap.
 */
export const APP_ROLES = [
  "super_admin",
  "academy_admin",
  "coach",
  "finance",
  "player",
  "guardian",
] as const;

export const ACCOUNT_STATUSES = [
  "pending",
  "active",
  "suspended",
  "archived",
] as const;

export const grantRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(APP_ROLES),
});

export const revokeRoleSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
});

export const accountStatusSchema = z.object({
  userId: z.string().uuid(),
  status: z.enum(ACCOUNT_STATUSES),
});

/**
 * Linking a login to an academy record.
 *
 * The kind decides which table is written, and both are checked against the
 * account before the write — a link is what makes is_player() and
 * guards_player() true, so getting it wrong hands one family another family's
 * records.
 */
export const accountLinkSchema = z.object({
  userId: z.string().uuid(),
  kind: z.enum(["player", "guardian"]),
  recordId: z.string().uuid("Choose a record"),
});

export const accountUnlinkSchema = z.object({
  userId: z.string().uuid(),
  kind: z.enum(["player", "guardian"]),
  recordId: z.string().uuid(),
});
