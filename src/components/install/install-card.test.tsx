import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InstallCard, InstallCardView } from "./install-card";

const render = (props: Partial<Parameters<typeof InstallCardView>[0]>) =>
  renderToStaticMarkup(
    <InstallCardView platform="ios-safari" dismissed={false} canPrompt={false} {...props} />,
  );

describe("InstallCard", () => {
  it("renders nothing on the server, where the platform is not known", () => {
    expect(renderToStaticMarkup(<InstallCard siteUrl="https://www.zeneratestudio.com/" />)).toBe("");
  });
});

describe("InstallCardView", () => {
  it("renders nothing in the installed app", () => {
    expect(render({ platform: "installed" })).toBe("");
  });

  it("renders nothing before the platform is known or while dismissed", () => {
    expect(render({ platform: null })).toBe("");
    expect(render({ dismissed: null })).toBe("");
    expect(render({ dismissed: true })).toBe("");
  });

  it("offers the steps on an iPhone, with Not now", () => {
    const html = render({ platform: "ios-safari" });
    expect(html).toContain("Get the Zenerate app");
    expect(html).toContain("Show me how");
    expect(html).toContain("Not now");
    expect(html).toContain("bg-card");
    expect(html).not.toMatch(/shadow-/);
  });

  it("offers Chrome's own Install on Android once it is ready, steps until then", () => {
    expect(render({ platform: "android", canPrompt: true })).toContain(">Install</button>");
    const steps = render({ platform: "android", canPrompt: false });
    expect(steps).toContain("Show me how");
    expect(steps).not.toContain(">Install</button>");
  });

  it("points a computer at the phone", () => {
    const html = render({ platform: "desktop" });
    expect(html).toContain("Zenerate is best on your phone");
    expect(html).toContain("Open on your phone");
  });
});
