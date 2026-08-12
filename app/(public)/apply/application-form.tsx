"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { submitApplicationAction } from "@/lib/applications/actions";
import {
  emptyApplicationActionState,
  type ApplicationActionState,
} from "@/lib/applications/action-state";
import {
  HEARD_ABOUT_OPTIONS,
  PROGRAM_OPTIONS,
  RELATIONSHIP_OPTIONS,
} from "@/lib/applications/labels";
import { GENDERS, GENDER_LABELS, POSITIONS, POSITION_LABELS } from "@/lib/players/labels";

/**
 * Public enrolment form — the only way a parent joins the academy.
 *
 * This used to take no account details, which meant enrolling was two
 * disconnected jobs: apply here, register separately at /signup, and wait for an
 * administrator to work out that the two belonged to each other. The form now
 * creates the login as well, so applying and registering are one act.
 *
 * The account is created on submit but gains nothing until staff approve — see
 * submitApplicationAction.
 */
export function ApplicationForm() {
  const [state, formAction, isPending] = useActionState<
    ApplicationActionState,
    FormData
  >(submitApplicationAction, emptyApplicationActionState);

  const err = (name: string) => state.fieldErrors?.[name];

  if (state.ok) {
    return (
      <Alert tone="success">
        <p className="font-medium">Application received</p>
        <p className="mt-1">{state.message}</p>
      </Alert>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {state.message && !state.ok ? (
        <Alert tone="danger">{state.message}</Alert>
      ) : null}

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-sm font-semibold tracking-wide uppercase">
          About the player
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            name="playerFirstName"
            label="First name"
            required
            maxLength={100}
            error={err("playerFirstName")}
          />
          <Input
            name="playerLastName"
            label="Last name"
            required
            maxLength={100}
            error={err("playerLastName")}
          />
          <Input
            name="dateOfBirth"
            type="date"
            label="Date of birth"
            required
            error={err("dateOfBirth")}
          />
          <Select name="gender" label="Gender" defaultValue="undisclosed">
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {GENDER_LABELS[g]}
              </option>
            ))}
          </Select>
          <Select name="position" label="Preferred position" defaultValue="">
            <option value="">Not sure / any</option>
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {POSITION_LABELS[p]}
              </option>
            ))}
          </Select>
          <Input name="school" label="School" maxLength={200} error={err("school")} />
        </div>

        <Textarea
          name="previousExperience"
          label="Previous basketball experience"
          rows={3}
          maxLength={2000}
          hint="Optional. Teams played for, years playing, or none at all."
          error={err("previousExperience")}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-sm font-semibold tracking-wide uppercase">
          Parent or guardian
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            name="guardianName"
            label="Full name"
            required
            maxLength={160}
            autoComplete="name"
            error={err("guardianName")}
          />
          <Select
            name="guardianRelationship"
            label="Relationship to player"
            defaultValue="parent"
          >
            {RELATIONSHIP_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </Select>
          <Input
            name="guardianPhone"
            type="tel"
            label="Phone"
            required
            autoComplete="tel"
            hint="e.g. +254 712 345678"
            error={err("guardianPhone")}
          />
          <Input
            name="guardianAltPhone"
            type="tel"
            label="Alternative phone"
            error={err("guardianAltPhone")}
          />
          <Input
            name="guardianEmail"
            type="email"
            label="Email"
            required
            autoComplete="email"
            className="sm:col-span-2"
            hint="You will sign in with this address."
            error={err("guardianEmail")}
          />
        </div>
      </fieldset>

      {/*
        Its own section rather than one more field among the contact details:
        submitting this form creates an account, and a password appearing
        without explanation invites the reader to wonder what it is for.
      */}
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-sm font-semibold tracking-wide uppercase">
          Your account
        </legend>

        <p className="-mt-1 text-sm text-[var(--foreground-muted)]">
          Applying creates your parent account, so there is nothing else to
          register. Once the coach approves the application you can sign in to
          follow your child&apos;s attendance, progress and fees.
        </p>

        <Input
          name="password"
          type="password"
          label="Choose a password"
          required
          autoComplete="new-password"
          hint="At least 8 characters, including a letter and a number."
          error={err("password")}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-sm font-semibold tracking-wide uppercase">
          Programme &amp; notes
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select name="programInterest" label="Programme of interest" defaultValue="">
            <option value="">Select a programme</option>
            {PROGRAM_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
          <Select name="heardAboutUs" label="How did you hear about us?" defaultValue="">
            <option value="">Select an option</option>
            {HEARD_ABOUT_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </Select>
        </div>

        <Textarea
          name="medicalNotes"
          label="Medical conditions or allergies"
          rows={3}
          maxLength={2000}
          hint="Anything the coaching staff should know. Shared only with academy staff."
          error={err("medicalNotes")}
        />
      </fieldset>

      <div className="flex flex-col gap-3">
        <Button type="submit" size="lg" loading={isPending} className="sm:self-start">
          Submit application
        </Button>
        <p className="text-xs text-[var(--foreground-muted)]">
          We use these details only to contact you about joining the academy.
        </p>
      </div>
    </form>
  );
}
