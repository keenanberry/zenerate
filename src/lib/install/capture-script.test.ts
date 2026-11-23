import { describe, expect, it } from "vitest";
import {
  INSTALL_CHANGE,
  INSTALL_HEAD_SCRIPT,
  INSTALLED_KEY,
  PROMPT_KEY,
  STANDALONE_ATTR,
} from "./capture-script";

const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const ANDROID_WEBVIEW =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36";
const DESKTOP =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const IPHONE_APP =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const SIGNED_IN = "theme=dark; sb-xnvqjqobegcpkigkmoct-auth-token.0=base64-abc; sb-xnvqjqobegcpkigkmoct-auth-token.1=def";

/** Runs the inline script against a stand-in window and document. */
function run({
  userAgent,
  standalone,
  displayModes = [],
  cookie = "",
}: {
  userAgent: string;
  standalone?: boolean;
  displayModes?: string[];
  cookie?: string;
}) {
  const listeners: Record<string, ((e: Event) => void)[]> = {};
  const dispatched: string[] = [];
  const attributes: Record<string, string> = {};
  const win: Record<string, unknown> = {
    addEventListener: (type: string, fn: (e: Event) => void) => {
      (listeners[type] ??= []).push(fn);
    },
    dispatchEvent: (e: Event) => {
      dispatched.push(e.type);
      return true;
    },
    matchMedia: (query: string) => ({
      matches: displayModes.some((mode) => query === `(display-mode: ${mode})`),
    }),
  };
  const doc = {
    cookie,
    documentElement: {
      setAttribute: (name: string, value: string) => {
        attributes[name] = value;
      },
    },
  };
  new Function("window", "document", "navigator", INSTALL_HEAD_SCRIPT)(win, doc, {
    userAgent,
    standalone,
  });
  const fire = (type: string) => {
    const event = new Event(type, { cancelable: true });
    listeners[type]?.forEach((fn) => fn(event));
    return event;
  };
  return { win, fire, dispatched, attributes, listening: Object.keys(listeners) };
}

describe("INSTALL_HEAD_SCRIPT, the installed-app marker", () => {
  it("marks <html> in an iOS home-screen app, which may not report display-mode", () => {
    expect(run({ userAgent: IPHONE_APP, standalone: true }).attributes).toEqual({
      [STANDALONE_ATTR]: "",
    });
  });

  it("marks it when the display mode is standalone or fullscreen", () => {
    expect(run({ userAgent: ANDROID, displayModes: ["standalone"] }).attributes).toHaveProperty(
      STANDALONE_ATTR,
    );
    expect(run({ userAgent: IPHONE_APP, displayModes: ["fullscreen"] }).attributes).toHaveProperty(
      STANDALONE_ATTR,
    );
  });

  it("leaves a browser tab unmarked", () => {
    expect(run({ userAgent: IPHONE_APP, standalone: false }).attributes).toEqual({});
    expect(run({ userAgent: DESKTOP }).attributes).toEqual({});
  });
});

describe("INSTALL_HEAD_SCRIPT, Chrome's install prompt", () => {
  it("keeps the prompt on Android and, signed in, holds back Chrome's banner", () => {
    const { win, fire, dispatched } = run({ userAgent: ANDROID, cookie: SIGNED_IN });
    const event = fire("beforeinstallprompt");
    expect(event.defaultPrevented).toBe(true);
    expect(win[PROMPT_KEY]).toBe(event);
    expect(dispatched).toEqual([INSTALL_CHANGE]);
    fire("appinstalled");
    expect(win[PROMPT_KEY]).toBeNull();
    expect(win[INSTALLED_KEY]).toBe(true);
  });

  it("leaves Chrome's banner to a signed-out visitor, keeping the event in case they sign in", () => {
    const { win, fire } = run({ userAgent: ANDROID, cookie: "theme=dark" });
    const event = fire("beforeinstallprompt");
    expect(event.defaultPrevented).toBe(false);
    expect(win[PROMPT_KEY]).toBe(event);
  });

  it("does not listen where no Install button is offered", () => {
    expect(run({ userAgent: DESKTOP, cookie: SIGNED_IN }).listening).toEqual([]);
    expect(run({ userAgent: ANDROID_WEBVIEW, cookie: SIGNED_IN }).listening).toEqual([]);
  });
});
