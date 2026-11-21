import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const desktop = vi.hoisted(() => ({ value: false }));
vi.mock("@/lib/use-is-desktop", () => ({ useIsDesktop: () => desktop.value }));

// Radix renders closed layers nowhere, so render every part inline, keeping
// the class the content is given.
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
    SheetTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
    SheetDescription: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
  };
});
vi.mock("@/components/ui/dropdown-menu", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    DropdownMenu: Pass,
    DropdownMenuTrigger: Pass,
    DropdownMenuContent: ({ children, className }: { children?: ReactNode; className?: string }) => (
      <ul data-dropdown className={className}>
        {children}
      </ul>
    ),
    DropdownMenuItem: ({ children }: { children?: ReactNode }) => <li>{children}</li>,
    DropdownMenuSeparator: () => <hr />,
  };
});
// The player around the menu loads audio and server actions; the menu needs neither.
vi.mock("@/lib/meditation/actions", () => ({ getMeditationAudio: async () => ({}) }));
vi.mock("@/components/use-waveform-player", () => ({
  formatTime: () => "0:00",
  useWaveformPlayer: () => ({}),
}));

const { SessionMenu } = await import("./session-player");

function render() {
  return renderToStaticMarkup(
    <SessionMenu
      open
      onOpenChange={() => {}}
      meditationId="abc-123"
      title="Rain & Release"
      tags={["sleep"]}
      meta="Sleep · 20 min"
      trigger={<button>More</button>}
    >
      <span>Download</span>
    </SessionMenu>,
  );
}

describe("SessionMenu", () => {
  it("on a phone, keeps its sheet dark in the light theme", () => {
    // The sheet portals to <body>, outside the session view's `.dark`.
    desktop.value = false;
    const html = render();
    expect(html).toMatch(/<section data-sheet="true" class="[^"]*\bdark\b[^"]*"/);
    expect(html).toContain("Sleep · 20 min");
    expect(html).not.toContain("data-dropdown");
  });

  it("on desktop, keeps its dropdown dark too", () => {
    desktop.value = true;
    const html = render();
    expect(html).toMatch(/<ul data-dropdown="true" class="[^"]*\bdark\b[^"]*"/);
    expect(html).not.toContain("data-sheet");
  });
});
