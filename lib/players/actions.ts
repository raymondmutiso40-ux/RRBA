"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth/session";
import { canCreatePlayers, canEditPlayers } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { playerSchema } from "@/lib/validation/schemas";
import type { PlayerActionState } from "@/lib/players/action-state";

/** "" → null, so optional DB columns stay null rather than empty strings. */
function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value === "" ? null : value;
}

/** Numeric inputs arrive as strings; "" means "not provided", not zero. */
function nullableNumber(formData: FormData, key: string): number | null {
  const value = text(formData, key);
  if (value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Shapes FormData into the schema's input type. Runs before validation so
 * Zod sees real numbers and nulls rather than raw form strings.
 */
function readPlayerForm(formData: FormData) {
  return {
    firstName: text(formData, "firstName"),
    lastName: text(formData, "lastName"),
    dateOfBirth: text(formData, "dateOfBirth"),
    gender: text(formData, "gender") || "undisclosed",
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    address: text(formData, "address"),
    position: nullableText(formData, "position"),
    jerseyNumber: nullableNumber(formData, "jerseyNumber"),
    heightCm: nullableNumber(formData, "heightCm"),
    weightKg: nullableNumber(formData, "weightKg"),
    dominantHand: nullableText(formData, "dominantHand"),
    status: text(formData, "status") || "applicant",
    notes: text(formData, "notes"),
  };
}

function collectFieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

/** Maps validated form values onto database column names. */
function toRow(values: ReturnType<typeof readPlayerForm> & object) {
  const parsed = playerSchema.parse(values);
  return {
    first_name: parsed.firstName,
    last_name: parsed.lastName,
    date_of_birth: parsed.dateOfBirth ? parsed.dateOfBirth : null,
    gender: parsed.gender,
    email: parsed.email ? parsed.email : null,
    phone: parsed.phone ? parsed.phone : null,
    address: parsed.address ? parsed.address : null,
    position: parsed.position ?? null,
    jersey_number: parsed.jerseyNumber ?? null,
    height_cm: parsed.heightCm ?? null,
    weight_kg: parsed.weightKg ?? null,
    dominant_hand: parsed.dominantHand ?? null,
    status: parsed.status ?? "applicant",
    notes: parsed.notes ? parsed.notes : null,
  };
}

/**
 * Creates a player.
 *
 * Validation runs again here even though the form validates in the browser:
 * a request can be sent directly to the server action, so client-side checks
 * are a convenience, never a control. RLS is the final backstop.
 */
export async function createPlayerAction(
  _prev: PlayerActionState,
  formData: FormData,
): Promise<PlayerActionState> {
  const user = await requireStaff();

  if (!canCreatePlayers(user.roles)) {
    return {
      ok: false,
      message: "Only academy administrators can add players.",
    };
  }

  const parsed = playerSchema.safeParse(readPlayerForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  const supabase = await createClient();
  const row = toRow(readPlayerForm(formData));

  const { data, error } = await supabase
    .from("players")
    .insert(row)
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      message: error?.message ?? "Could not save the player.",
    };
  }

  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "player.create",
    entity: "players",
    entity_id: data.id,
    metadata: { name: `${row.first_name} ${row.last_name}` },
  });

  revalidatePath("/dashboard/players");
  redirect(`/dashboard/players/${data.id}`);
}

/**
 * Updates a player.
 *
 * Coaches may edit players on their own teams; the `players_coach_update`
 * policy decides which rows they can actually touch, so a coach editing
 * someone else's player fails at the database even though the role check
 * here passes.
 */
export async function updatePlayerAction(
  _prev: PlayerActionState,
  formData: FormData,
): Promise<PlayerActionState> {
  const user = await requireStaff();

  if (!canEditPlayers(user.roles)) {
    return { ok: false, message: "You cannot edit player records." };
  }

  const playerId = text(formData, "playerId");
  if (!playerId) {
    return { ok: false, message: "Missing player reference." };
  }

  const parsed = playerSchema.safeParse(readPlayerForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  const supabase = await createClient();
  const row = toRow(readPlayerForm(formData));

  const { data, error } = await supabase
    .from("players")
    .update(row)
    .eq("id", playerId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, message: error.message };
  }

  // No row came back: RLS filtered the update out. Report it as permission
  // denied rather than a silent success.
  if (!data) {
    return {
      ok: false,
      message: "You do not have permission to edit this player.",
    };
  }

  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "player.update",
    entity: "players",
    entity_id: playerId,
    metadata: { name: `${row.first_name} ${row.last_name}` },
  });

  revalidatePath("/dashboard/players");
  revalidatePath(`/dashboard/players/${playerId}`);
  redirect(`/dashboard/players/${playerId}`);
}
