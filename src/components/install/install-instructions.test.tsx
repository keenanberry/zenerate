import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { displayUrl, InstallInstructions, installTitle } from "./install-instructions";

const SITE = "https://www.zeneratestudio.com/";
const render = (props: Partial<Parameters<typeof InstallInstructions>[0]>) =>
  renderToStaticMarkup(<InstallInstructions platform="ios-safari" siteUrl={SITE} {...props} />);
const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&#x27;|&apos;/g, "'");

describe("InstallInstructions", () => {
  it("walks Safari through Share, Add to Home Screen and Add", () => {
    const t = text(render({ platform: "ios-safari" }));
    expect(t).toContain("Tap Share");
    expect(t).toContain("Safari's toolbar");
    expect(t).toContain("Choose Add to Home Screen");
    expect(t).toContain("Tap Add");
    expect(render({ platform: "ios-safari" }).match(/<li/g)).toHaveLength(3);
  });

  it("says where Share is in the other iOS browsers", () => {
    expect(text(render({ platform: "ios-other", browser: "Chrome" }))).toContain(
      "In Chrome it is in the address bar",
    );
    expect(text(render({ platform: "ios-other", browser: "Firefox" }))).toContain(
      "In Firefox, open the menu first",
    );
    expect(text(render({ platform: "ios-other", browser: null }))).toContain(
      "address bar or its menu",
    );
  });

  it("gives Android the menu steps when the browser has not offered its prompt", () => {
    const t = text(render({ platform: "android", canPrompt: false }));
    expect(t).toContain("Open the ⋮ menu");
    expect(t).not.toMatch(/top right/);
    expect(t).toContain("Choose Install app");
    expect(t).toContain("Add to Home screen");
  });

  it("sends an iOS in-app browser to Safari, with the address written out", () => {
    const html = render({ platform: "in-app", os: "ios" });
    const t = text(html);
    expect(t).toContain("Open this page in Safari");
    expect(t).toContain("Open in Safari");
    expect(html).toContain('href="https://www.zeneratestudio.com/library"');
    expect(t).toContain("www.zeneratestudio.com/library into Safari");
  });

  it("sends an Android in-app browser to Chrome", () => {
    const t = text(render({ platform: "in-app", os: "android" }));
    expect(t).toContain("Open this page in Chrome");
    expect(t).toContain("into Chrome");
  });

  it("keeps only the written link when the address is too long for a QR code", () => {
    const long = `https://example.com/${"a".repeat(300)}`;
    const html = render({ platform: "desktop", siteUrl: long });
    expect(html).not.toContain("<svg");
    expect(html).toContain(`href="${long}"`);
  });

  it("uses the type scale's weights only", () => {
    for (const platform of ["ios-safari", "android", "in-app", "desktop"] as const) {
      expect(render({ platform })).not.toMatch(/font-(semibold|bold)/);
    }
  });

  it("shows a computer a QR code of the site and the address written out", () => {
    const html = render({ platform: "desktop" });
    expect(html).toContain(`aria-label="QR code for ${SITE}"`);
    expect(html).toMatch(/<path d="M\d/);
    expect(html).toContain(`href="${SITE}"`);
    expect(html).toContain(">www.zeneratestudio.com</a>");
  });
});

describe("installTitle", () => {
  it("fits the platform", () => {
    expect(installTitle("desktop", false)).toBe("Zenerate is best on your phone");
    expect(installTitle("android", true)).toBe("Install Zenerate");
    expect(installTitle("ios-safari", false)).toBe("Add Zenerate to your home screen");
    expect(installTitle("in-app", false)).toBe("Open Zenerate in your browser first");
  });
});

describe("displayUrl", () => {
  it("drops the scheme and the trailing slash", () => {
    expect(displayUrl("https://www.zeneratestudio.com/")).toBe("www.zeneratestudio.com");
  });
});
