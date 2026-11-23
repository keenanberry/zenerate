import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { InstallPlatform } from "@/lib/install/platform";
import { InstallCard, InstallCardView } from "./install-card";

const SITE = "https://www.zeneratestudio.com/";
const serverRender = (initialPlatform: InstallPlatform, initialDismissed = false) =>
  renderToStaticMarkup(
    <InstallCard
      siteUrl={SITE}
      initialPlatform={initialPlatform}
      initialDismissed={initialDismissed}
    />,
  );
const render = (props: Partial<Parameters<typeof InstallCardView>[0]>) =>
  renderToStaticMarkup(
    <InstallCardView platform="ios-safari" dismissed={false} canPrompt={false} {...props} />,
  );

describe("InstallCard on the server", () => {
  it("is in the first paint, decided from the user agent", () => {
    const html = serverRender("ios-safari");
    expect(html).toContain("Get the Zenerate app");
    expect(html).toContain("Show me how");
  });

  it("hides itself in the installed app with CSS, before any script runs", () => {
    expect(serverRender("android")).toMatch(/<section[^>]*class="[^"]*standalone:hidden/);
  });

  it("is left out while dismissed", () => {
    expect(serverRender("ios-safari", true)).toBe("");
  });

  it("does not fade in, so nothing about it changes after paint", () => {
    expect(serverRender("desktop")).not.toMatch(/animate-in|fade-in/);
  });
});

describe("InstallCardView", () => {
  it("renders nothing in the installed app", () => {
    expect(render({ platform: "installed" })).toBe("");
  });

  it("renders nothing without a platform or while dismissed", () => {
    expect(render({ platform: null })).toBe("");
    expect(render({ dismissed: true })).toBe("");
  });

  it("offers the steps on an iPhone, with Not now", () => {
    const html = render({ platform: "ios-safari" });
    expect(html).toContain("Show me how");
    expect(html).toContain("Not now");
    expect(html).toContain("bg-card");
    expect(html).not.toMatch(/shadow-/);
  });

  it("offers Chrome's own Install on Android once it is ready, in the same slot", () => {
    const install = render({ platform: "android", canPrompt: true });
    const steps = render({ platform: "android", canPrompt: false });
    expect(install).toContain(">Install</button>");
    expect(steps).toContain("Show me how");
    expect(steps).not.toContain(">Install</button>");
    // Same buttons, same size: only the label and icon differ.
    const sizes = (html: string) => html.match(/data-size="[^"]+"/g);
    expect(sizes(install)).toEqual(sizes(steps));
  });

  it("points a computer at the phone", () => {
    const html = render({ platform: "desktop" });
    expect(html).toContain("Zenerate is best on your phone");
    expect(html).toContain("Open on your phone");
  });

  it("shows in an in-app browser too, whose sheet sends people to a real browser", () => {
    expect(render({ platform: "in-app" })).toContain("Show me how");
  });
});
