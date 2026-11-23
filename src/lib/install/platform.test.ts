import { describe, expect, it } from "vitest";
import { detectInstallPlatform, iosBrowserName } from "./platform";

const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1",
  iphoneFirefox:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/133.0 Mobile/15E148 Safari/605.1.15",
  iphoneEdge:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/131.2903.68 Mobile/15E148 Safari/605.1.15",
  ipadDesktopSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  androidSamsung:
    "Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
  macChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  windowsEdge:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
  linuxFirefox: "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0",
  kaios: "Mozilla/5.0 (Mobile; LYF/F300B/LYF-F300B-001-01-15-130718-i;Android; rv:48.0) Gecko/48.0 Firefox/48.0 KAIOS/2.5",
};

const detect = (userAgent: string, extra: Partial<Parameters<typeof detectInstallPlatform>[0]> = {}) =>
  detectInstallPlatform({ userAgent, displayModeStandalone: false, ...extra });

describe("detectInstallPlatform", () => {
  it("says installed when running standalone, whatever the browser", () => {
    expect(detect(UA.androidChrome, { displayModeStandalone: true })).toBe("installed");
    expect(detect(UA.iphoneSafari, { navigatorStandalone: true })).toBe("installed");
    expect(detect(UA.macChrome, { displayModeStandalone: true })).toBe("installed");
  });

  it("tells Safari on iOS from the other iOS browsers", () => {
    expect(detect(UA.iphoneSafari)).toBe("ios-safari");
    expect(detect(UA.iphoneChrome)).toBe("ios-other");
    expect(detect(UA.iphoneFirefox)).toBe("ios-other");
    expect(detect(UA.iphoneEdge)).toBe("ios-other");
  });

  it("treats a Mac user agent with touch points as an iPad", () => {
    expect(detect(UA.ipadDesktopSafari, { maxTouchPoints: 5 })).toBe("ios-safari");
    expect(detect(UA.ipadDesktopSafari, { maxTouchPoints: 0 })).toBe("desktop");
  });

  it("recognises Android browsers", () => {
    expect(detect(UA.androidChrome)).toBe("android");
    expect(detect(UA.androidSamsung)).toBe("android");
  });

  it("recognises computers", () => {
    expect(detect(UA.macChrome)).toBe("desktop");
    expect(detect(UA.windowsEdge)).toBe("desktop");
    expect(detect(UA.linuxFirefox)).toBe("desktop");
  });

  it("falls back to other for what it does not know", () => {
    expect(detect("")).toBe("other");
    expect(detect(UA.kaios)).toBe("android");
    expect(detect("Mozilla/5.0 (Mobile; rv:48.0) Gecko/48.0 Firefox/48.0 KAIOS/2.5")).toBe("other");
  });
});

describe("iosBrowserName", () => {
  it("names the browser, or nothing for Safari and the rest", () => {
    expect(iosBrowserName(UA.iphoneChrome)).toBe("Chrome");
    expect(iosBrowserName(UA.iphoneFirefox)).toBe("Firefox");
    expect(iosBrowserName(UA.iphoneEdge)).toBe("Edge");
    expect(iosBrowserName(UA.iphoneSafari)).toBeNull();
  });
});
