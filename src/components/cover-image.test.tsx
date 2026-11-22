import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The suite runs in node with no DOM renderer, so React's useState is
 * replaced by a minimal runner: state lives in slots by call order, kept
 * across renders, and a setter updates its slot (functional updates too).
 * Rendering is calling CoverImage and reading the props it hands the view.
 */
const slots: unknown[] = [];
let cursor = 0;
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState<T>(initial: T) {
    const i = cursor++;
    if (!(i in slots)) slots[i] = initial;
    const set = (next: T | ((prev: T) => T)) => {
      slots[i] = typeof next === "function" ? (next as (prev: T) => T)(slots[i] as T) : next;
    };
    return [slots[i] as T, set] as const;
  },
}));

const { CoverImage, CoverImageView, coverLoaded, coverLoadView } = await import("./cover-image");

type ViewProps = Parameters<typeof CoverImageView>[0];

const A = "https://x.supabase.co/storage/v1/object/public/meditation-covers/m1/a.webp";
const B = "https://x.supabase.co/storage/v1/object/public/meditation-covers/m1/b.webp";
const thumb = (url: string) => url.replace(/\.webp$/, ".thumb.webp");
const designed = <svg data-motif="moon" />;

function render(src: string, extra: { onLoaded?: () => void } = {}): ViewProps {
  cursor = 0;
  const element = CoverImage({ src, size: 56, alt: "", className: "rounded-md", fallback: designed, ...extra }) as ReactElement<ViewProps>;
  return element.props;
}

describe("CoverImage", () => {
  beforeEach(() => {
    slots.length = 0;
  });

  it("holds the tile until the current file loads, then shows it", () => {
    const onLoaded = vi.fn();
    const before = render(A, { onLoaded });
    expect(before.loaded).toBe(false);
    expect(before.underlay).toBeNull();
    before.onLoad();
    expect(onLoaded).toHaveBeenCalledOnce();
    const after = render(A, { onLoaded });
    expect(after.loaded).toBe(true);
    expect(after.underlay).toBeNull();
  });

  it("starts a fallen-through file on the tile again", () => {
    const first = render(A);
    first.onError();
    const next = render(A);
    expect(next.failures).toBe(1);
    expect(next.loaded).toBe(false);
    next.onLoad();
    expect(render(A).loaded).toBe(true);
  });

  it("keeps the old photo under a new cover until the new one loads, and while it fades in", () => {
    render(A).onLoad();
    const replaced = render(B);
    expect(replaced.loaded).toBe(false);
    expect(replaced.underlay).toBe(thumb(A));
    replaced.onLoad();
    const after = render(B);
    expect(after.loaded).toBe(true);
    expect(after.underlay).toBe(thumb(A));
  });
});

describe("the load bookkeeping", () => {
  it("records the newest file and the one before it", () => {
    const one = coverLoaded({ loaded: null, previous: null }, "a");
    expect(one).toEqual({ loaded: "a", previous: null });
    expect(coverLoaded(one, "a")).toBe(one);
    expect(coverLoaded(one, "b")).toEqual({ loaded: "b", previous: "a" });
    expect(coverLoadView({ loaded: "a", previous: null }, "b")).toEqual({ loaded: false, underlay: "a" });
    expect(coverLoadView({ loaded: "b", previous: "a" }, "b")).toEqual({ loaded: true, underlay: "a" });
  });

  it("draws the underlay beneath the new photo, hidden from assistive tech", () => {
    const html = renderToStaticMarkup(
      <CoverImageView
        src={B}
        size={56}
        alt="Evening"
        className=""
        failures={0}
        loaded={false}
        underlay={thumb(A)}
        onLoad={() => {}}
        onError={() => {}}
        fallback={designed}
      />,
    );
    const under = html.indexOf(`src="${thumb(A)}"`);
    const current = html.indexOf(`src="${thumb(B)}"`);
    expect(under).toBeGreaterThan(-1);
    expect(current).toBeGreaterThan(under);
    expect(html).toMatch(/<img[^>]*aria-hidden="true"[^>]*src="[^"]*a\.thumb\.webp"|<img[^>]*src="[^"]*a\.thumb\.webp"[^>]*aria-hidden="true"/);
  });
});
