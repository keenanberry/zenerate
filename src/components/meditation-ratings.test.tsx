import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock("@/lib/meditation/actions", () => ({ toggleFavorite: async () => {} }));

import { MeditationPageProvider } from "./meditation-page";
import { MeditationRatings } from "./meditation-ratings";
import type { RatingStats } from "@/lib/meditation/ratings";

function render(
  stats: RatingStats | null | undefined,
  rating?: { canRate: boolean; stars: number | null; ratedAt: string | null },
) {
  return renderToStaticMarkup(
    <MeditationPageProvider meditationId="m1" isFavorited={false} rating={rating}>
      <MeditationRatings title="Evening Calm" stats={stats} />
    </MeditationPageProvider>,
  );
}

const lastYear = "2025-11-01T12:00:00Z";

describe("MeditationRatings", () => {
  it("is absent when there is nothing to show", () => {
    expect(render(undefined)).toBe("");
    expect(render(undefined, { canRate: false, stars: 4, ratedAt: lastYear })).toBe("");
  });

  it("shows the average with its count in words, and no stars to someone who may not rate", () => {
    const html = render({ average: 4.6, count: 1250 });
    expect(html).toContain(">Ratings<");
    expect(html).toContain(">4.6<");
    expect(html).toContain("1.3k ratings");
    expect(html).not.toContain('role="group"');
  });

  it("says when there are none yet", () => {
    expect(render(null)).toContain("No ratings yet");
  });

  it("asks a listener who has not rated, without Clear", () => {
    const html = render(null, { canRate: true, stars: null, ratedAt: null });
    expect(html).toContain("Rate this meditation");
    expect(html).toContain('aria-label="Rate Evening Calm"');
    expect(html).not.toContain("Clear");
  });

  it("shows the listener's rating and Clear, leaving the date to the browser", () => {
    const html = render({ average: 4, count: 1 }, { canRate: true, stars: 4, ratedAt: lastYear });
    expect(html).toContain("Your rating");
    expect(html).toMatch(/aria-label="4 stars" aria-pressed="true"/);
    expect(html).toContain("Clear");
    // The server's time zone is not the reader's: no date in the server HTML.
    expect(html).not.toContain("ago");
  });
});
