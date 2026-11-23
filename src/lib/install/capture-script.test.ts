import { describe, expect, it } from "vitest";
import { CAPTURE_SCRIPT, INSTALL_CHANGE, INSTALLED_KEY, PROMPT_KEY } from "./capture-script";

const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const ANDROID_WEBVIEW =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36";
const DESKTOP =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Runs the inline script against a stand-in window and returns it. */
function run(userAgent: string) {
  const listeners: Record<string, ((e: Event) => void)[]> = {};
  const dispatched: string[] = [];
  const win: Record<string, unknown> = {
    addEventListener: (type: string, fn: (e: Event) => void) => {
      (listeners[type] ??= []).push(fn);
    },
    dispatchEvent: (e: Event) => {
      dispatched.push(e.type);
      return true;
    },
  };
  new Function("window", "navigator", CAPTURE_SCRIPT)(win, { userAgent });
  const fire = (type: string) => {
    const event = new Event(type, { cancelable: true });
    listeners[type]?.forEach((fn) => fn(event));
    return event;
  };
  return { win, fire, dispatched, listening: Object.keys(listeners) };
}

describe("CAPTURE_SCRIPT", () => {
  it("keeps Chrome's prompt on Android, holding back its own banner", () => {
    const { win, fire, dispatched } = run(ANDROID);
    const event = fire("beforeinstallprompt");
    expect(event.defaultPrevented).toBe(true);
    expect(win[PROMPT_KEY]).toBe(event);
    expect(dispatched).toEqual([INSTALL_CHANGE]);
    fire("appinstalled");
    expect(win[PROMPT_KEY]).toBeNull();
    expect(win[INSTALLED_KEY]).toBe(true);
  });

  it("leaves the prompt alone where no Install button is offered", () => {
    expect(run(DESKTOP).listening).toEqual([]);
    expect(run(ANDROID_WEBVIEW).listening).toEqual([]);
  });
});
