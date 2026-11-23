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
    expect(t).toContain("Open the menu");
    expect(t).toContain("Choose Install app");
    expect(t).toContain("Add to Home screen");
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
  });
});

describe("displayUrl", () => {
  it("drops the scheme and the trailing slash", () => {
    expect(displayUrl("https://www.zeneratestudio.com/")).toBe("www.zeneratestudio.com");
  });
});
