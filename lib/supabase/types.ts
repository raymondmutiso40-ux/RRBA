/**
 * Database types.
 *
 * Hand-written for M0 to cover the tables the foundation actually queries.
 * Once a Supabase project exists, regenerate the full file with:
 *
 *   npx supabase gen types typescript --project-id <id> > lib/supabase/types.ts
 *
 * Keep the generated output in git so type errors surface at build time
 * rather than at runtime.
 */

export type AppRole =
  | "super_admin"
  | "academy_admin"
  | "coach"
  | "finance"
  | "player"
  | "guardian";

export type AccountStatus = "pending" | "active" | "suspended" | "archived";

export type Gender = "male" | "female" | "other" | "undisclosed";

export type PlayerStatus =
  | "applicant"
  | "active"
  | "inactive"
  | "graduated"
  | "withdrawn";

export type BasketballPosition =
  | "point_guard"
  | "shooting_guard"
  | "small_forward"
  | "power_forward"
  | "center";

export type EventType = "training" | "match";
export type EventStatus = "scheduled" | "completed" | "cancelled";
export type MatchResult = "win" | "loss" | "draw";
export type AttendanceStatus = "present" | "absent" | "late" | "excused";
export type InvoiceStatus =
  | "draft"
  | "issued"
  | "partially_paid"
  | "paid"
  | "void";
export type PaymentState = "pending" | "confirmed" | "failed" | "reversed";
export type FeeInterval = "one_time" | "monthly" | "termly" | "annual";
export type PaymentMethod =
  | "cash"
  | "mpesa"
  | "bank_transfer"
  | "cheque"
  | "card"
  | "other";

export type ApplicationStatus =
  | "pending"
  | "approved"
  | "declined"
  | "withdrawn";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          phone: string | null;
          avatar_path: string | null;
          status: AccountStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string;
          phone?: string | null;
          avatar_path?: string | null;
          status?: AccountStatus;
        };
        Update: {
          email?: string;
          full_name?: string;
          phone?: string | null;
          avatar_path?: string | null;
          status?: AccountStatus;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: AppRole;
          granted_by: string | null;
          granted_at: string;
        };
        Insert: {
          user_id: string;
          role: AppRole;
          granted_by?: string | null;
        };
        Update: {
          role?: AppRole;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: number;
          actor_id: string | null;
          action: string;
          entity: string;
          entity_id: string | null;
          metadata: Record<string, unknown>;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          actor_id?: string | null;
          action: string;
          entity: string;
          entity_id?: string | null;
          metadata?: Record<string, unknown>;
          ip_address?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      players: {
        Row: {
          id: string;
          profile_id: string | null;
          first_name: string;
          last_name: string;
          date_of_birth: string;
          gender: Gender;
          photo_path: string | null;
          email: string | null;
          phone: string | null;
          address: string | null;
          position: BasketballPosition | null;
          jersey_number: number | null;
          height_cm: number | null;
          weight_kg: number | null;
          dominant_hand: string | null;
          status: PlayerStatus;
          registration_date: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          first_name: string;
          last_name: string;
          date_of_birth: string;
          gender?: Gender;
          profile_id?: string | null;
          photo_path?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          position?: BasketballPosition | null;
          jersey_number?: number | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          dominant_hand?: string | null;
          status?: PlayerStatus;
          registration_date?: string;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["players"]["Insert"]>;
        Relationships: [];
      };
      seasons: {
        Row: {
          id: string;
          name: string;
          starts_on: string;
          ends_on: string;
          is_current: boolean;
          created_at: string;
        };
        Insert: {
          name: string;
          starts_on: string;
          ends_on: string;
          is_current?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["seasons"]["Insert"]>;
        Relationships: [];
      };
      teams: {
        Row: {
          id: string;
          name: string;
          age_group: string;
          gender: Gender;
          season_id: string | null;
          description: string | null;
          logo_path: string | null;
          min_age: number | null;
          max_age: number | null;
          is_active: boolean;
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          age_group: string;
          gender?: Gender;
          season_id?: string | null;
          description?: string | null;
          logo_path?: string | null;
          min_age?: number | null;
          max_age?: number | null;
          is_active?: boolean;
          is_public?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["teams"]["Insert"]>;
        Relationships: [];
      };
      coach_public_profiles: {
        Row: {
          coach_id: string;
          display_name: string;
          headline: string;
          bio: string | null;
          sort_order: number;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          coach_id: string;
          display_name: string;
          headline?: string;
          bio?: string | null;
          sort_order?: number;
          published_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["coach_public_profiles"]["Insert"]
        >;
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          event_type: EventType;
          team_id: string | null;
          title: string;
          description: string | null;
          starts_at: string;
          ends_at: string;
          location: string | null;
          status: EventStatus;
          coach_id: string | null;
          opponent: string | null;
          competition: string | null;
          is_home: boolean | null;
          final_score_team: number | null;
          final_score_opp: number | null;
          result: MatchResult | null;
          stats_recorded: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          event_type: EventType;
          title: string;
          starts_at: string;
          ends_at: string;
          team_id?: string | null;
          description?: string | null;
          location?: string | null;
          status?: EventStatus;
          coach_id?: string | null;
          opponent?: string | null;
          competition?: string | null;
          is_home?: boolean | null;
          // Null until a match is played. Writable so recording a result is an
          // update rather than a second table.
          final_score_team?: number | null;
          final_score_opp?: number | null;
          result?: MatchResult | null;
          stats_recorded?: boolean;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["events"]["Insert"]>;
        Relationships: [];
      };
      event_participants: {
        Row: {
          id: string;
          event_id: string;
          player_id: string;
          added_by: string | null;
          created_at: string;
        };
        Insert: {
          event_id: string;
          player_id: string;
          added_by?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["event_participants"]["Insert"]
        >;
        Relationships: [];
      };
      attendance: {
        Row: {
          id: string;
          event_id: string;
          player_id: string;
          status: AttendanceStatus;
          marked_by: string | null;
          notes: string | null;
          marked_at: string;
        };
        Insert: {
          event_id: string;
          player_id: string;
          status?: AttendanceStatus;
          marked_by?: string | null;
          notes?: string | null;
          // attendance has no updated_at trigger, so a correction has to carry
          // its own timestamp — otherwise marked_at keeps the original mark.
          marked_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["attendance"]["Insert"]>;
        Relationships: [];
      };
      player_match_stats: {
        Row: {
          id: string;
          event_id: string;
          player_id: string;
          minutes_played: number | null;
          points: number | null;
          rebounds: number | null;
          assists: number | null;
          steals: number | null;
          blocks: number | null;
          turnovers: number | null;
          fouls: number | null;
          fg_attempts: number | null;
          fg_made: number | null;
          three_attempts: number | null;
          three_made: number | null;
          ft_attempts: number | null;
          ft_made: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          event_id: string;
          player_id: string;
          // Every stat is optional: a coach who only has points and rebounds to
          // hand should be able to save those without inventing the rest, and
          // null reads as "not recorded" rather than as zero.
          minutes_played?: number | null;
          points?: number | null;
          rebounds?: number | null;
          assists?: number | null;
          steals?: number | null;
          blocks?: number | null;
          turnovers?: number | null;
          fouls?: number | null;
          fg_attempts?: number | null;
          fg_made?: number | null;
          three_attempts?: number | null;
          three_made?: number | null;
          ft_attempts?: number | null;
          ft_made?: number | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["player_match_stats"]["Insert"]
        >;
        Relationships: [];
      };
      skill_metrics: {
        Row: {
          id: string;
          code: string;
          label: string;
          category: string;
          description: string | null;
          sort_order: number;
          is_active: boolean;
        };
        Insert: {
          code: string;
          label: string;
          category?: string;
          description?: string | null;
          sort_order?: number;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["skill_metrics"]["Insert"]>;
        Relationships: [];
      };
      assessments: {
        Row: {
          id: string;
          player_id: string;
          assessed_by: string;
          event_id: string | null;
          assessed_on: string;
          summary: string | null;
          created_at: string;
        };
        Insert: {
          player_id: string;
          assessed_by: string;
          event_id?: string | null;
          assessed_on?: string;
          summary?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["assessments"]["Insert"]>;
        Relationships: [];
      };
      assessment_scores: {
        Row: {
          id: string;
          assessment_id: string;
          metric_id: string;
          score: number;
        };
        Insert: {
          assessment_id: string;
          metric_id: string;
          score: number;
        };
        Update: Partial<
          Database["public"]["Tables"]["assessment_scores"]["Insert"]
        >;
        Relationships: [];
      };
      development_notes: {
        Row: {
          id: string;
          player_id: string;
          coach_id: string;
          note: string;
          created_at: string;
        };
        Insert: {
          player_id: string;
          coach_id: string;
          note: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["development_notes"]["Insert"]
        >;
        Relationships: [];
      };
      fee_types: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          amount: number;
          currency: string;
          interval: FeeInterval;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          name: string;
          amount: number;
          description?: string | null;
          currency?: string;
          interval?: FeeInterval;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["fee_types"]["Insert"]>;
        Relationships: [];
      };
      invoices: {
        Row: {
          id: string;
          invoice_number: string;
          player_id: string;
          fee_type_id: string | null;
          description: string;
          amount_due: number;
          currency: string;
          period_start: string | null;
          period_end: string | null;
          issued_on: string;
          due_on: string;
          status: InvoiceStatus;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          player_id: string;
          description: string;
          amount_due: number;
          due_on: string;
          // Defaulted by next_invoice_number() since migration 009 — only pass
          // one to import a number issued outside the system.
          invoice_number?: string;
          fee_type_id?: string | null;
          currency?: string;
          period_start?: string | null;
          period_end?: string | null;
          issued_on?: string;
          status?: InvoiceStatus;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["invoices"]["Insert"]>;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          receipt_number: string;
          invoice_id: string;
          player_id: string;
          amount: number;
          currency: string;
          method: PaymentMethod;
          state: PaymentState;
          paid_on: string;
          reference: string | null;
          payer_name: string | null;
          payer_phone: string | null;
          notes: string | null;
          recorded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          invoice_id: string;
          player_id: string;
          amount: number;
          method: PaymentMethod;
          // Defaulted by next_receipt_number() since migration 009.
          receipt_number?: string;
          currency?: string;
          state?: PaymentState;
          paid_on?: string;
          reference?: string | null;
          payer_name?: string | null;
          payer_phone?: string | null;
          notes?: string | null;
          recorded_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
        Relationships: [];
      };
      contact_submissions: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          phone: string | null;
          subject: string | null;
          message: string;
          player_age: number | null;
          is_application: boolean;
          handled_by: string | null;
          handled_at: string | null;
          created_at: string;
        };
        Insert: {
          full_name: string;
          email: string;
          message: string;
          phone?: string | null;
          subject?: string | null;
          player_age?: number | null;
          is_application?: boolean;
        };
        Update: {
          handled_by?: string | null;
          handled_at?: string | null;
        };
        Relationships: [];
      };
      applications: {
        Row: {
          id: string;
          player_first_name: string;
          player_last_name: string;
          date_of_birth: string;
          gender: Gender;
          position: BasketballPosition | null;
          school: string | null;
          previous_experience: string | null;
          guardian_name: string;
          guardian_relationship: string;
          guardian_phone: string;
          guardian_email: string | null;
          guardian_alt_phone: string | null;
          program_interest: string | null;
          medical_notes: string | null;
          heard_about_us: string | null;
          status: ApplicationStatus;
          reviewed_by: string | null;
          reviewed_at: string | null;
          review_notes: string | null;
          created_player_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          player_first_name: string;
          player_last_name: string;
          date_of_birth: string;
          guardian_name: string;
          guardian_phone: string;
          gender?: Gender;
          position?: BasketballPosition | null;
          school?: string | null;
          previous_experience?: string | null;
          guardian_relationship?: string;
          guardian_email?: string | null;
          guardian_alt_phone?: string | null;
          program_interest?: string | null;
          medical_notes?: string | null;
          heard_about_us?: string | null;
        };
        Update: {
          status?: ApplicationStatus;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_notes?: string | null;
          created_player_id?: string | null;
        };
        Relationships: [];
      };
      team_players: {
        Row: {
          id: string;
          team_id: string;
          player_id: string;
          joined_at: string;
          left_at: string | null;
        };
        Insert: {
          team_id: string;
          player_id: string;
          joined_at?: string;
          left_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["team_players"]["Insert"]>;
        Relationships: [];
      };
      team_coaches: {
        Row: {
          id: string;
          team_id: string;
          coach_id: string;
          is_lead: boolean;
          assigned_at: string;
          unassigned_at: string | null;
        };
        Insert: {
          team_id: string;
          coach_id: string;
          is_lead?: boolean;
          assigned_at?: string;
          unassigned_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["team_coaches"]["Insert"]>;
        Relationships: [];
      };
      guardians: {
        Row: {
          id: string;
          profile_id: string | null;
          full_name: string;
          relationship: string;
          email: string | null;
          phone: string;
          alt_phone: string | null;
          address: string | null;
          occupation: string | null;
          is_emergency_contact: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          full_name: string;
          phone: string;
          profile_id?: string | null;
          relationship?: string;
          email?: string | null;
          alt_phone?: string | null;
          address?: string | null;
          occupation?: string | null;
          is_emergency_contact?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["guardians"]["Insert"]>;
        Relationships: [];
      };
      player_guardians: {
        Row: {
          id: string;
          player_id: string;
          guardian_id: string;
          is_primary: boolean;
          can_collect: boolean;
          created_at: string;
        };
        Insert: {
          player_id: string;
          guardian_id: string;
          is_primary?: boolean;
          can_collect?: boolean;
        };
        Update: Partial<
          Database["public"]["Tables"]["player_guardians"]["Insert"]
        >;
        Relationships: [];
      };
      player_medical: {
        Row: {
          player_id: string;
          blood_group: string | null;
          allergies: string | null;
          chronic_conditions: string | null;
          medications: string | null;
          dietary_requirements: string | null;
          insurance_provider: string | null;
          insurance_number: string | null;
          doctor_name: string | null;
          doctor_phone: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          last_physical_on: string | null;
          cleared_to_play: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          player_id: string;
          blood_group?: string | null;
          allergies?: string | null;
          chronic_conditions?: string | null;
          medications?: string | null;
          dietary_requirements?: string | null;
          insurance_provider?: string | null;
          insurance_number?: string | null;
          doctor_name?: string | null;
          doctor_phone?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          last_physical_on?: string | null;
          cleared_to_play?: boolean;
          notes?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["player_medical"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Views: {
      invoice_balances: {
        Row: {
          invoice_id: string;
          invoice_number: string;
          player_id: string;
          amount_due: number;
          currency: string;
          due_on: string;
          status: InvoiceStatus;
          amount_paid: number;
          balance: number;
          is_overdue: boolean;
        };
        Relationships: [];
      };
      player_account_summary: {
        Row: {
          player_id: string;
          invoice_count: number;
          total_billed: number;
          total_paid: number;
          total_outstanding: number;
          has_overdue: boolean | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      approve_application: {
        Args: {
          target_application: string;
          assign_team?: string | null;
          notes?: string | null;
        };
        Returns: string;
      };
      count_active_super_admins: {
        Args: { exclude_grant?: string | null };
        Returns: number;
      };
      has_any_admin: { Args: Record<string, never>; Returns: boolean };
      has_role: { Args: { target_role: AppRole }; Returns: boolean };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_staff: { Args: Record<string, never>; Returns: boolean };
      next_invoice_number: { Args: Record<string, never>; Returns: string };
      next_receipt_number: { Args: Record<string, never>; Returns: string };
    };
    Enums: {
      app_role: AppRole;
      account_status: AccountStatus;
      application_status: ApplicationStatus;
      gender: Gender;
      player_status: PlayerStatus;
      basketball_position: BasketballPosition;
      event_type: EventType;
      event_status: EventStatus;
      match_result: MatchResult;
      attendance_status: AttendanceStatus;
      invoice_status: InvoiceStatus;
      payment_state: PaymentState;
      fee_interval: FeeInterval;
      payment_method: PaymentMethod;
    };
  };
}

/** Row shape of a public table, e.g. `Tables<"players">`. */
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

/** Insert shape of a public table. */
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

/** Update shape of a public table. */
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
