import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RatingPrompt } from "./rating-prompt";
import { RatingSummary } from "./rating-summary";
import { StarRating } from "./star-rating";

const noop = () => {};

describe("StarRating", () => {
  it("is five labelled buttons in a named group, the chosen one pressed", () => {
    const html = renderToStaticMarkup(
      <StarRating value={3} onRate={noop} label="Rate Evening Calm" />,
    );
    expect(html).toMatch(/role="group" aria-label="Rate Evening Calm"/);
    expect(html.match(/<button/g)).toHaveLength(5);
    expect(html).toContain('aria-label="1 star"');
    expect(html).toMatch(/aria-label="3 stars" aria-pressed="true"/);
    expect(html).toMatch(/aria-label="4 stars" aria-pressed="false"/);
  });

  it("presses none before a rating", () => {
    const html = renderToStaticMarkup(<StarRating value={null} onRate={noop} label="Rate" />);
    expect(html).not.toContain('aria-pressed="true"');
  });
});

describe("RatingSummary", () => {
  it("shows the average alone, with the count in words for screen readers", () => {
    const html = renderToStaticMarkup(<RatingSummary stats={{ average: 4.6, count: 128 }} />);
    expect(html).toContain(">4.6<");
    expect(html).not.toContain("(128)");
    expect(html).toContain("Rated 4.6 out of 5 by 128 listeners");
  });

  it("shows nothing without ratings", () => {
    expect(renderToStaticMarkup(<RatingSummary stats={undefined} />)).toBe("");
    expect(renderToStaticMarkup(<RatingSummary stats={null} />)).toBe("");
    expect(renderToStaticMarkup(<RatingSummary stats={{ average: 0, count: 0 }} />)).toBe("");
  });
});

describe("RatingPrompt", () => {
  const render = (placement: "session" | "page") =>
    renderToStaticMarkup(
      <RatingPrompt
        title="Evening Calm"
        placement={placement}
        onRate={async () => true}
        onClose={noop}
      />,
    );

  it("asks about the meditation by title, with five stars, Not now and a close", () => {
    const html = render("session");
    expect(html).toContain("How was this meditation?");
    expect(html).toContain("Evening Calm");
    expect(html).toMatch(/role="group" aria-label="Rate Evening Calm"/);
    expect(html.match(/aria-label="\d stars?"/g)).toHaveLength(5);
    expect(html).toContain("Not now");
    expect(html).toContain('aria-label="Close"');
  });

  it("is a modal dialog in the session view and a non-modal sheet on the page", () => {
    expect(render("session")).toMatch(/role="dialog" aria-modal="true"/);
    expect(render("page")).toMatch(/role="dialog" aria-modal="false"/);
    expect(render("page")).toContain("fixed");
  });

  it("resumes the thank-you when it moves into the session view after a rating", () => {
    const html = renderToStaticMarkup(
      <RatingPrompt title="Evening Calm" placement="session" rated onRate={async () => true} onClose={noop} />,
    );
    expect(html).toContain("Thank you");
    expect(html).not.toContain("How was this meditation?");
  });
});
