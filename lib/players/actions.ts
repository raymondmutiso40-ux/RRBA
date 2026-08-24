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
 * Minimal CSV parser that supports the CSV produced by Google Sheets,
 * including quoted values containing commas.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === "," && !quoted) {
      row.push(field.trim());
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field.trim());
      field = "";
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      continue;
    }

    field += char;
  }

  if (field !== "" || row.length) {
    row.push(field.trim());
    if (row.some((value) => value !== "")) rows.push(row);
  }

  return rows;
}

function normalizeCsvHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function csvValue(row: string[], headers: Map<string, number>, ...names: string[]) {
  for (const name of names) {
    const index = headers.get(name);
    if (index != null) return (row[index] ?? "").trim();
  }
  return "";
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
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
 * Imports players from a CSV file.
 *
 * Expected Google Sheets columns:
 *   Name (or Full Name), Age, Phone, Guardian
 *
 * First name/last name columns are also accepted. Age and Guardian are
 * optional and are preserved in Notes when supplied. The import is
 * all-or-nothing: if any row is invalid, no players are inserted.
 */
export async function importPlayersCsvAction(
  _prev: PlayerActionState,
  formData: FormData,
): Promise<PlayerActionState> {
  const user = await requireStaff();

  if (!canCreatePlayers(user.roles)) {
    return {
      ok: false,
      message: "Only academy administrators can import players.",
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, message: "Choose a CSV file to import." };
  }

  if (file.size === 0) {
    return { ok: false, message: "The selected CSV file is empty." };
  }

  if (file.size > 2 * 1024 * 1024) {
    return { ok: false, message: "CSV file is too large. Maximum size is 2 MB." };
  }

  const rows = parseCsv(await file.text());
  if (rows.length < 2) {
    return {
      ok: false,
      message: "The CSV must contain a header row and at least one player.",
    };
  }

  const headerValues = (rows[0] ?? []).map(normalizeCsvHeader);
  const headers = new Map<string, number>();
  headerValues.forEach((header, index) => {
    if (header && !headers.has(header)) headers.set(header, index);
  });

  const hasFullName = ["name", "full_name", "fullname"].some((key) => headers.has(key));
  const hasSplitName = headers.has("first_name") && headers.has("last_name");
  const phoneHeader = ["phone", "phone_number", "phone_no", "mobile"].find((key) => headers.has(key));

  if (!hasFullName && !hasSplitName) {
    return {
      ok: false,
      message: "CSV needs a Name/Full Name column, or First Name and Last Name columns.",
    };
  }

  if (!phoneHeader) {
    return {
      ok: false,
      message: "CSV needs a Phone column. Phone numbers are compulsory.",
    };
  }

  const validatedRows: Array<{
    rowNumber: number;
    values: ReturnType<typeof readPlayerForm>;
    row: ReturnType<typeof toRow>;
  }> = [];
  const errors: string[] = [];
  const seenPhones = new Set<string>();
  const seenNames = new Set<string>();

  rows.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    const fullName = hasFullName
      ? csvValue(row, headers, "name", "full_name", "fullname")
      : "";
    const splitName = splitFullName(fullName);
    const firstName = hasSplitName
      ? csvValue(row, headers, "first_name")
      : splitName.firstName;
    const lastName = hasSplitName
      ? csvValue(row, headers, "last_name")
      : splitName.lastName;
    const phone = csvValue(row, headers, phoneHeader);
    const age = csvValue(row, headers, "age");
    const guardian = csvValue(row, headers, "guardian", "guardian_relationship", "relationship");

    const normalizedPhone = phone.replace(/[\s()-]/g, "");
    const normalizedName = `${firstName} ${lastName}`.trim().toLowerCase();

    if (seenPhones.has(normalizedPhone) && normalizedPhone) {
      errors.push(`Row ${rowNumber}: duplicate phone number ${phone}.`);
      return;
    }
    if (seenNames.has(normalizedName) && normalizedName) {
      errors.push(`Row ${rowNumber}: duplicate player name ${firstName} ${lastName}.`);
      return;
    }

    const values = {
      firstName,
      lastName,
      dateOfBirth: "",
      gender: "undisclosed" as const,
      email: "",
      phone,
      address: "",
      position: null,
      jerseyNumber: null,
      heightCm: null,
      weightKg: null,
      dominantHand: null,
      status: "active" as const,
      notes: [age ? `Age at import: ${age}` : "", guardian ? `Guardian: ${guardian}` : ""]
        .filter(Boolean)
        .join(" | "),
    };

    const parsed = playerSchema.safeParse(values);
    if (!parsed.success) {
      const messages = parsed.error.issues.map((issue) => issue.message).join(", ");
      errors.push(`Row ${rowNumber} (${firstName} ${lastName}): ${messages}`);
      return;
    }

    seenPhones.add(normalizedPhone);
    seenNames.add(normalizedName);
    validatedRows.push({
      rowNumber,
      values,
      row: toRow(values),
    });
  });

  if (errors.length) {
    return {
      ok: false,
      message: `Import stopped. Fix ${errors.length} row${errors.length === 1 ? "" : "s"} and upload the CSV again. ${errors.slice(0, 8).join(" ")}`,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("players")
    .insert(validatedRows.map((item) => item.row))
    .select("id, first_name, last_name");

  if (error || !data) {
    return {
      ok: false,
      message: error?.message ?? "Could not import the players.",
    };
  }

  await supabase.from("audit_log").insert(
    data.map((player) => ({
      actor_id: user.id,
      action: "player.import",
      entity: "players",
      entity_id: player.id,
      metadata: {
        name: `${player.first_name} ${player.last_name}`,
        source: file.name,
      },
    })),
  );

  revalidatePath("/dashboard/players");
  return {
    ok: true,
    message: `Successfully imported ${data.length} player${data.length === 1 ? "" : "s"}.`,
  };
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
