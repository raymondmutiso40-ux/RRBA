"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  saveCoachProfileAction,
  setCoachProfilePublishedAction,
} from "@/lib/website/actions";
import {
  emptyWebsiteActionState,
  type WebsiteActionState,
} from "@/lib/website/action-state";

/**
 * The biography an administrator writes for a coach.
 *
 * maxLength on each field matches the CHECK constraints on
 * coach_public_profiles, so the browser stops at the same point the database
 * would — and the schema re-validates on the server regardless.
 */
export function CoachProfileForm({
  coachId,
  displayName,
  headline,
  bio,
  sortOrder,
}: {
  coachId: string;
  displayName: string;
  headline: string;
  bio: string;
  sortOrder: number;
}) {
  const [state, formAction, isPending] = useActionState<
    WebsiteActionState,
    FormData
  >(saveCoachProfileAction, emptyWebsiteActionState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="coachId" value={coachId} />

      {state.message ? (
        <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Input
          name="displayName"
          label="Name on the website"
          defaultValue={displayName}
          maxLength={80}
          required
          hint="How the coach is known to players and parents."
          error={state.fieldErrors?.displayName}
        />
        <Input
          name="sortOrder"
          label="Order"
          type="number"
          min={0}
          max={999}
          defaultValue={sortOrder}
          hint="Lower numbers come first."
          error={state.fieldErrors?.sortOrder}
        />
      </div>

      <Input
        name="headline"
        label="Headline"
        defaultValue={headline}
        maxLength={120}
        placeholder="e.g. Head Coach — Elite Programme"
        hint="One line under the name. Optional."
        error={state.fieldErrors?.headline}
      />

      <Textarea
        name="bio"
        label="Biography"
        defaultValue={bio}
        rows={7}
        maxLength={1200}
        placeholder="Playing background, coaching experience, what they focus on with players."
        hint="Shown to the public. Leave out anything the coach would not want on the open internet."
        error={state.fieldErrors?.bio}
      />

      <div>
        <Button type="submit" loading={isPending}>
          Save profile
        </Button>
      </div>
    </form>
  );
}

/**
 * Publish or withdraw the profile.
 *
 * Separate form, separate action, so the destructive-ish direction reads as a
 * decision of its own. Unpublishing keeps the text — it only takes the profile
 * off the site, which is what an admin wants when a coach is on a break rather
 * than gone.
 */
export function CoachPublishControls({
  coachId,
  isPublished,
  publishedLabel,
}: {
  coachId: string;
  isPublished: boolean;
  publishedLabel: string | null;
}) {
  const [state, formAction, isPending] = useActionState<
    WebsiteActionState,
    FormData
  >(setCoachProfilePublishedAction, emptyWebsiteActionState);

  return (
    <div className="flex flex-col gap-4">
      {state.message ? (
        <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>
      ) : null}

      {isPublished && publishedLabel ? (
        <p className="text-sm text-[var(--foreground-muted)]">
          Published {publishedLabel}.
        </p>
      ) : null}

      <form action={formAction}>
        <input type="hidden" name="coachId" value={coachId} />
        <input
          type="hidden"
          name="publish"
          value={isPublished ? "false" : "true"}
        />
        <Button
          type="submit"
          variant={isPublished ? "outline" : "primary"}
          loading={isPending}
        >
          {isPublished ? "Take off the website" : "Publish to the website"}
        </Button>
      </form>
    </div>
  );
}
