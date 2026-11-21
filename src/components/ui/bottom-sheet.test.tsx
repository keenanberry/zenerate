import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Radix renders a closed sheet's content nowhere, so render every part inline.
vi.mock("@/components/ui/sheet", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    Sheet: Pass,
    SheetTrigger: Pass,
    SheetContent: ({ children, className }: { children?: ReactNode; className?: string }) => (
      <section data-sheet className={className}>
        {children}
      </section>
    ),
    SheetTitle: ({ children, className }: { children?: ReactNode; className?: string }) => (
      <h2 className={className}>{children}</h2>
    ),
    SheetDescription: ({ children, className }: { children?: ReactNode; className?: string }) => (
      <p className={className}>{children}</p>
    ),
  };
});

const { BottomSheet, BottomSheetContent, BottomSheetItem, BottomSheetSeparator } = await import(
  "./bottom-sheet"
);

function render(node: ReactNode) {
  return renderToStaticMarkup(<BottomSheet open>{node}</BottomSheet>);
}

describe("BottomSheetContent", () => {
  it("shows the title as a visible heading under a grab handle", () => {
    const html = render(<BottomSheetContent title="Rain & Release">rows</BottomSheetContent>);
    expect(html).toContain("data-sheet-handle");
    expect(html.indexOf("data-sheet-handle")).toBeLessThan(html.indexOf("Rain &amp; Release"));
    const heading = html.match(/<h2 class="([^"]*)">Rain &amp; Release<\/h2>/);
    expect(heading).not.toBeNull();
    expect(heading![1]).not.toContain("sr-only");
  });

  it("keeps the title for screen readers only when a header names the item", () => {
    const html = render(
      <BottomSheetContent title="More for Rain & Release" header={<p>Rain &amp; Release</p>}>
        rows
      </BottomSheetContent>,
    );
    expect(html).toMatch(/<h2 class="[^"]*sr-only[^"]*">More for Rain &amp; Release<\/h2>/);
    expect(html).toContain("<p>Rain &amp; Release</p>");
  });

  it("is the popover surface, rounded on top, and clears the home indicator", () => {
    const html = render(<BottomSheetContent title="T">rows</BottomSheetContent>);
    const sheet = html.match(/<section data-sheet="true" class="([^"]*)"/)![1];
    expect(sheet).toContain("bg-popover");
    expect(sheet).toContain("rounded-t-2xl");
    expect(sheet).toContain("max-h-[85dvh]");
    // No open, close or spring-back animation under reduced motion.
    expect(sheet).toContain("motion-reduce:animate-none");
    expect(html).toContain("env(safe-area-inset-bottom,0px)");
  });

  it("passes its className to the sheet, so a caller can re-scope the theme", () => {
    const html = render(
      <BottomSheetContent title="T" className="dark">
        rows
      </BottomSheetContent>,
    );
    expect(html).toMatch(/<section data-sheet="true" class="[^"]*\bdark\b/);
  });
});

describe("BottomSheetItem", () => {
  it("is a full-width row at least 52px tall", () => {
    const html = render(<BottomSheetItem>Share</BottomSheetItem>);
    expect(html).toMatch(/<button[^>]*class="[^"]*min-h-13/);
  });

  it("marks a destructive row in the destructive colour", () => {
    const html = render(<BottomSheetItem variant="destructive">Delete</BottomSheetItem>);
    expect(html).toMatch(/<button[^>]*class="[^"]*text-destructive/);
  });

  it("puts its look on a link when asChild", () => {
    const html = render(
      <BottomSheetItem asChild>
        <a href="/x">Download</a>
      </BottomSheetItem>,
    );
    expect(html).toMatch(/<a [^>]*class="[^"]*min-h-13[^"]*"[^>]*>Download<\/a>/);
    expect(html).not.toContain("<button");
  });

  it("separates groups with a hairline", () => {
    expect(render(<BottomSheetSeparator />)).toMatch(/role="separator"[^>]*class="[^"]*bg-border/);
  });
});
