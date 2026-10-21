/**
 * The fixed tag vocabulary. The studio agent assigns 2 to 5 of these through
 * `setDetails`, which validates against `TAGS` as a Zod enum, so nothing else
 * reaches `meditations.tags`. Discover filters and category cards read the
 * same list.
 *
 * Slugs are stored in the database. Renaming one strands every row that has
 * it, so add new tags freely but rename or remove only with a data migration.
 */
export const TAG_GROUPS = {
  themes: [
    "stress-relief",
    "anxiety",
    "sleep",
    "focus",
    "gratitude",
    "self-compassion",
    "confidence",
    "letting-go",
    "grief",
    "energy",
    "creativity",
    "inner-peace",
  ],
  practices: [
    "breathwork",
    "body-scan",
    "visualization",
    "loving-kindness",
    "mantra",
    "open-awareness",
    "progressive-relaxation",
    "grounding",
    "affirmations",
  ],
  moments: [
    "morning",
    "midday-reset",
    "after-work",
    "bedtime",
    "rough-day",
    "before-a-big-moment",
    "short-break",
  ],
} as const;

export const TAGS = [
  ...TAG_GROUPS.themes,
  ...TAG_GROUPS.practices,
  ...TAG_GROUPS.moments,
] as const;

export type Tag = (typeof TAGS)[number];

export type TagGroup = keyof typeof TAG_GROUPS;

export const TAG_LABELS: Record<Tag, string> = {
  "stress-relief": "Stress relief",
  anxiety: "Anxiety",
  sleep: "Sleep",
  focus: "Focus",
  gratitude: "Gratitude",
  "self-compassion": "Self-compassion",
  confidence: "Confidence",
  "letting-go": "Letting go",
  grief: "Grief",
  energy: "Energy",
  creativity: "Creativity",
  "inner-peace": "Inner peace",
  breathwork: "Breathwork",
  "body-scan": "Body scan",
  visualization: "Visualization",
  "loving-kindness": "Loving-kindness",
  mantra: "Mantra",
  "open-awareness": "Open awareness",
  "progressive-relaxation": "Progressive relaxation",
  grounding: "Grounding",
  affirmations: "Affirmations",
  morning: "Morning",
  "midday-reset": "Midday reset",
  "after-work": "After work",
  bedtime: "Bedtime",
  "rough-day": "Rough day",
  "before-a-big-moment": "Before a big moment",
  "short-break": "Short break",
};

export function isTag(value: string): value is Tag {
  return (TAGS as readonly string[]).includes(value);
}

export type DiscoverCategory = {
  slug: string;
  label: string;
  /** A meditation belongs to the category when it has any of these tags. */
  tags: Tag[];
};

/**
 * The 8 category cards on /discover. The house seeding plan makes about 3
 * meditations per category, so every card opens onto a real list. Every tag
 * sits in at least one category, so nothing the agent assigns is unreachable
 * from Discover.
 */
export const DISCOVER_CATEGORIES: DiscoverCategory[] = [
  {
    slug: "sleep",
    label: "Sleep",
    tags: ["sleep", "bedtime", "progressive-relaxation"],
  },
  {
    slug: "stress-relief",
    label: "Stress relief",
    tags: ["stress-relief", "anxiety", "rough-day", "after-work"],
  },
  {
    slug: "focus",
    label: "Focus",
    tags: ["focus", "creativity", "visualization", "midday-reset", "short-break"],
  },
  {
    slug: "morning",
    label: "Morning",
    tags: ["morning", "energy"],
  },
  {
    slug: "kindness",
    label: "Kindness",
    tags: ["self-compassion", "loving-kindness", "gratitude"],
  },
  {
    slug: "breath-and-body",
    label: "Breath & body",
    tags: ["breathwork", "body-scan", "grounding"],
  },
  {
    slug: "confidence",
    label: "Confidence",
    tags: ["confidence", "affirmations", "before-a-big-moment"],
  },
  {
    slug: "letting-go",
    label: "Letting go",
    tags: ["letting-go", "grief", "inner-peace", "open-awareness", "mantra"],
  },
];

/**
 * Meditation types, as the wizard and track rows have always named them. The
 * agent picks one through `setDetails`; it is stored in `settings.type`.
 */
export const MEDITATION_TYPES = [
  "guided",
  "body-scan",
  "breathwork",
  "loving-kindness",
  "visualization",
  "mindfulness",
  "sleep",
  "manifestation",
  "mantra",
] as const;

export type MeditationType = (typeof MEDITATION_TYPES)[number];
