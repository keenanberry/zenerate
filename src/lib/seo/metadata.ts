import type { Metadata, MetadataRoute } from "next";
import type { Meditation } from "@/lib/meditation/types";

export const SITE_NAME = "Zenerate";

/** The locked pitch (PRODUCT.md). The default description; pages that matter set their own. */
export const PITCH = "Meditations composed for you, not picked from a catalogue.";

/** Used when NEXT_PUBLIC_SITE_URL is unset, so production shares still resolve. */
export const FALLBACK_SITE_URL = "https://www.zeneratestudio.com";

/** Search engines cut descriptions at around this length. */
const DESCRIPTION_MAX = 160;

/** public/og-image.png, built by scripts/build-icons.ts (task 23). */
const OG_IMAGE = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: `${SITE_NAME}: ${PITCH}`,
};

/**
 * The site origin that relative metadata URLs (OG image, canonicals, the
 * sitemap) resolve against. Accepts a bare host, since that is how it tends to
 * get pasted into Vercel, and falls back rather than throwing on a bad value:
 * a typo here should cost share previews, not every page render.
 */
export function resolveSiteUrl(value: string | undefined): URL {
  const raw = value?.trim();
  if (!raw) return new URL(FALLBACK_SITE_URL);
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return new URL(url.origin);
  } catch {
    return new URL(FALLBACK_SITE_URL);
  }
}

export const siteUrl = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

/** Cut to `max` characters at a word boundary, with an ellipsis if anything was cut. */
export function truncate(text: string, max = DESCRIPTION_MAX): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:—-]+$/, "")}…`;
}

/**
 * Site-wide defaults for the root layout. A page that sets `openGraph` or
 * `twitter` replaces the whole object, not single fields, so per-page
 * metadata goes through `pageMetadata`, which carries the image and card type
 * along.
 */
export const defaultMetadata = {
  metadataBase: siteUrl,
  title: `${SITE_NAME} — AI Meditation Generator`,
  description: PITCH,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    title: SITE_NAME,
    description: PITCH,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: PITCH,
    images: [OG_IMAGE],
  },
} satisfies Metadata;

/**
 * Metadata for a page worth sharing: its own title and description in the
 * head, the share card and a canonical URL. `socialTitle` is what a share card
 * shows above the site name, so it can drop the "| Zenerate" suffix.
 */
export function pageMetadata({
  title,
  socialTitle = title,
  description,
  path,
}: {
  title: string;
  socialTitle?: string;
  description: string;
  path: string;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      ...defaultMetadata.openGraph,
      title: socialTitle,
      description,
      url: path,
    },
    twitter: {
      ...defaultMetadata.twitter,
      title: socialTitle,
      description,
    },
  };
}

type MeditationForMetadata = Pick<Meditation, "id" | "title" | "is_public" | "settings">;

/**
 * "A 10-minute guided meditation on gratitude." The stored prompt is the
 * wizard's instruction to the model, not prose, so the description is built
 * from the settings it was made from instead.
 */
export function describeMeditation(settings: Meditation["settings"] | null): string {
  const duration =
    typeof settings?.duration === "number" && settings.duration > 0
      ? `${settings.duration}-minute `
      : "";
  const type = settings?.type ? `${settings.type.replace(/-/g, " ").toLowerCase()} ` : "";
  const kind = `${duration}${type}meditation`;
  // "An 8-minute", "an 11-minute", "an 18-minute": by sound, not spelling.
  const article = /^([aeiou]|8|11-|18-)/i.test(kind) ? "An" : "A";
  const focus = settings?.focus?.trim() ? ` on ${settings.focus.trim()}` : "";

  return truncate(
    `${article} ${kind}${focus}, written and narrated with AI on ${SITE_NAME}. Free to listen, no account needed.`,
  );
}

/**
 * Metadata for /meditation/[id], from the row the viewer's own RLS-bound read
 * returned (null when it returned nothing).
 *
 * - Nothing returned: missing, or private to someone else. RLS makes the two
 *   indistinguishable, and so does this: a generic title, nothing else.
 * - Private: RLS only returns it to its owner, so the title in their own tab
 *   shows them nothing they cannot already see. No description, no share
 *   card, and noindex in case that policy ever widens.
 * - Public: the full share card.
 */
export function meditationMetadata(meditation: MeditationForMetadata | null): Metadata {
  if (!meditation) {
    return { title: `Meditation | ${SITE_NAME}`, robots: { index: false } };
  }
  if (!meditation.is_public) {
    return { title: `${meditation.title} | ${SITE_NAME}`, robots: { index: false } };
  }
  return pageMetadata({
    title: `${meditation.title} | ${SITE_NAME}`,
    socialTitle: meditation.title,
    description: describeMeditation(meditation.settings),
    path: `/meditation/${meditation.id}`,
  });
}

/** Pages open to signed-out visitors, which are the only ones worth listing. */
const STATIC_PATHS = [
  { path: "/", changeFrequency: "monthly", priority: 1 },
  { path: "/discover", changeFrequency: "daily", priority: 0.8 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.2 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.2 },
] as const;

export function sitemapEntries(
  base: URL,
  meditations: Pick<Meditation, "id" | "updated_at">[],
): MetadataRoute.Sitemap {
  return [
    ...STATIC_PATHS.map(({ path, changeFrequency, priority }) => ({
      url: new URL(path, base).href,
      changeFrequency,
      priority,
    })),
    ...meditations.map((m) => ({
      url: new URL(`/meditation/${m.id}`, base).href,
      lastModified: m.updated_at,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
