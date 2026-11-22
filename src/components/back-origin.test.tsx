import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

/**
 * The suite has no DOM renderer, so MeditationParentLink is called as a
 * function: effects run at once, memos compute, the store reads its snapshot,
 * a ref persists between calls, and the click handler is read off the link.
 */
const refs: { current: unknown }[] = [];
let refIndex = 0;
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useEffect: (effect: () => void) => effect(),
  useMemo: (compute: () => unknown) => compute(),
  useSyncExternalStore: (_: unknown, getSnapshot: () => unknown) => getSnapshot(),
  useRef: (initial: unknown) => (refs[refIndex++] ??= { current: initial }),
}));
const back = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ back }) }));

const { MeditationParentLink } = await import("./back-origin");
const { BACK_ORIGIN_KEY } = await import("@/lib/navigation/back-origin");

const STATE_KEY = "zenerateBackToken";
const store = new Map<string, string>();
const history = {
  state: null as Record<string, unknown> | null,
  replaceState(state: Record<string, unknown>) {
    this.state = state;
  },
};

function render() {
  refIndex = 0;
  const link = MeditationParentLink({ meditationId: "m1", isOwner: false }) as ReactElement<{
    href: string;
    onClick: (e: unknown) => void;
    children: string;
  }>;
  return link.props;
}

function click(onClick: (e: unknown) => void) {
  const event = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, preventDefault: vi.fn() };
  onClick(event);
  return event;
}

function record(extra: Record<string, unknown> = {}) {
  store.set(
    BACK_ORIGIN_KEY,
    JSON.stringify({ meditationId: "m1", href: "/discover?category=sleep", label: "Discover", token: "t1", ...extra }),
  );
}

describe("MeditationParentLink", () => {
  beforeEach(() => {
    refs.length = 0;
    store.clear();
    history.state = { __NA: true };
    back.mockClear();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
      },
      history,
      dispatchEvent: () => true,
    });
  });

  it("after a recorded click: names the list, tags the entry and goes back", () => {
    record({ pendingAt: Date.now() });
    const { href, children, onClick } = render();
    expect(href).toBe("/discover?category=sleep");
    expect(children).toBe("Discover");
    expect(history.state?.[STATE_KEY]).toBe("t1");
    expect(click(onClick).preventDefault).toHaveBeenCalled();
    expect(back).toHaveBeenCalledOnce();
  });

  it("still goes back after a refresh or server action rewrites history.state without the tag", () => {
    record({ pendingAt: Date.now() });
    render();
    // What Next's HistoryUpdater does after favouriting or rating.
    history.state = { __NA: true };
    click(render().onClick);
    expect(back).toHaveBeenCalledOnce();
  });

  it("a record this entry was not opened from: follows the link instead", () => {
    record();
    const event = click(render().onClick);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });
});
