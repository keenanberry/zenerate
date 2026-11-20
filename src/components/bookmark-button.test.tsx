import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { resetBookmarkOverrides, setBookmarkOverride } from "@/lib/meditation/bookmark-state";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));

const { BookmarkButton } = await import("./bookmark-button");

function render(props: Partial<Parameters<typeof BookmarkButton>[0]> = {}) {
  return renderToStaticMarkup(
    <TooltipProvider>
      <BookmarkButton meditationId="m1" isBookmarked={false} isSignedIn title="Evening Calm" {...props} />
    </TooltipProvider>,
  );
}

afterEach(() => resetBookmarkOverrides());

describe("BookmarkButton", () => {
  it("is an unpressed Save for later, named for the meditation", () => {
    const html = render();
    expect(html).toContain('aria-label="Save Evening Calm for later"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("lucide-bookmark");
    expect(html).not.toContain("fill-current");
  });

  it("is pressed and filled once saved", () => {
    const html = render({ isBookmarked: true });
    expect(html).toContain('aria-label="Remove Evening Calm from saved"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("fill-current");
  });

  it("is a plain button signed out, with no pressed state to claim", () => {
    const html = render({ isSignedIn: false });
    expect(html).toContain('aria-label="Save Evening Calm for later"');
    expect(html).not.toContain("aria-pressed");
  });

  it("renders the server's word on the server, whatever the tab changed since", () => {
    // useSyncExternalStore's server snapshot is used in a static render, so
    // the override shows on the client only; the server's word stands here.
    setBookmarkOverride("m1", true);
    expect(render()).toContain('aria-pressed="false"');
  });
});
