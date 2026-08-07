/**
 * Marketing copy for the public site.
 *
 * Everything a non-developer might want to change lives here rather than being
 * scattered through JSX, so updating the phone number or an age group is a
 * one-file edit.
 *
 * !! PLACEHOLDERS !!
 * The figures in `stats`, plus `contact.phone` and `contact.email`, are stand-in
 * values. Replace them with the academy's real numbers before sharing the site
 * publicly — they are presented to visitors as fact.
 */

export const academy = {
  name: "Runda Ridge Basketball Academy",
  shortName: "Runda Ridge",
  initials: "RR",
  location: "Runda, Nairobi",
  tagline: "Where Nairobi's next generation learns to compete",
  intro:
    "Structured coaching, real game minutes, and development tracked session " +
    "by session — so every player can see how far they have come.",
} as const;

export const instagram = {
  handle: "@r.r.b.a",
  url: "https://www.instagram.com/r.r.b.a/",
} as const;

export const contact = {
  /** PLACEHOLDER — replace with the academy's real number. */
  phone: "+254 700 000 000",
  /** PLACEHOLDER — replace with the academy's real address. */
  email: "hello@rundaridge.co.ke",
  trainingDays: "Tuesday, Thursday & Saturday",
} as const;

/** PLACEHOLDER FIGURES — replace all four with real numbers. */
export const stats = [
  { value: "120+", label: "Players coached" },
  { value: "6", label: "Age-group teams" },
  { value: "12", label: "Skills tracked per player" },
  { value: "5", label: "Years on the court" },
] as const;

export const programs = [
  {
    id: "mini",
    name: "Mini Ballers",
    ages: "Ages 6–9",
    summary:
      "First touches. Ball handling, footwork and coordination taught through " +
      "games, so the fundamentals land before the pressure does.",
    points: ["Two sessions weekly", "Small-sided games", "No experience needed"],
  },
  {
    id: "development",
    name: "Development Squad",
    ages: "Ages 10–13",
    summary:
      "The building years. Shooting mechanics, defensive stance and reading " +
      "the floor, with skill assessments logged every term.",
    points: ["Three sessions weekly", "Termly assessments", "Friendly fixtures"],
  },
  {
    id: "elite",
    name: "Elite Programme",
    ages: "Ages 14–18",
    summary:
      "Competitive basketball. Position-specific work, strength and " +
      "conditioning, and per-game statistics for every player on the roster.",
    points: ["Four sessions weekly", "League fixtures", "Full match stats"],
  },
  {
    id: "clinics",
    name: "Holiday Clinics",
    ages: "All ages",
    summary:
      "Intensive school-holiday camps. A week of concentrated coaching, open " +
      "to academy members and newcomers alike.",
    points: ["April, August & December", "Daily sessions", "Open enrolment"],
  },
] as const;

export const pillars = [
  {
    icon: "target",
    title: "Coaching with a plan",
    body:
      "Every session has an objective that ladders into the term's goals. " +
      "Players know what they are working on and why.",
  },
  {
    icon: "activity",
    title: "Progress you can see",
    body:
      "Twelve development areas assessed over time, from ball handling to " +
      "basketball IQ. Parents get a clear picture, not a vague impression.",
  },
  {
    icon: "trophy",
    title: "Real competition",
    body:
      "Regular fixtures with per-player statistics recorded for every match. " +
      "Growth is measured against live opposition, not just drills.",
  },
  {
    icon: "shield",
    title: "A safe environment",
    body:
      "Vetted coaches, tracked attendance, and a registered guardian on every " +
      "player record. Discipline and respect are non-negotiable.",
  },
] as const;
