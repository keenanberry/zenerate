import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

/**
 * The suite has no DOM renderer, so the component is called as a function:
 * React's effects run at once, a ref persists between calls, and the click
 * handler is read off the returned link.
 */
const refs: { current: unknown }[] = [];
let refIndex = 0;
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useEffect: (effect: () => void) => effect(),
  useRef: (initial: unknown) => (refs[refIndex++] ??= { current: initial }),
}));
const back = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ back }) }));

const { AccountBackLink } = await import("./account-back-link");
const { ACCOUNT_RETURN_KEY, ACCOUNT_STATE_KEY } = await import("@/lib/navigation/account-return");

const store = new Map<string, string>();
const history = {
  state: null as Record<string, unknown> | null,
  replaceState(state: Record<string, unknown>) {
    this.state = state;
  },
};

/** One render: the link's click handler. */
function render() {
  refIndex = 0;
  const button = AccountBackLink({}) as ReactElement<{ children: ReactElement<{ onClick: (e: unknown) => void; href: string }> }>;
  return button.props.children.props;
}

function click(onClick: (e: unknown) => void) {
  const event = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, preventDefault: vi.fn() };
  onClick(event);
  return event;
}

describe("AccountBackLink", () => {
  beforeEach(() => {
    refs.length = 0;
    store.clear();
    history.state = { __NA: true };
    back.mockClear();
    vi.stubGlobal("window", {
      sessionStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) },
      history,
    });
  });

  it("after an avatar click: tags the entry and goes back", () => {
    store.set(ACCOUNT_RETURN_KEY, JSON.stringify({ token: "t1", pendingAt: Date.now() }));
    const { onClick, href } = render();
    expect(history.state?.[ACCOUNT_STATE_KEY]).toBe("t1");
    expect(href).toBe("/library");
    const event = click(onClick);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(back).toHaveBeenCalledOnce();
  });

  it("still goes back after a refresh rewrites history.state without the tag", () => {
    store.set(ACCOUNT_RETURN_KEY, JSON.stringify({ token: "t1", pendingAt: Date.now() }));
    render();
    // What Next's HistoryUpdater does on router.refresh() or a server action.
    history.state = { __NA: true };
    const { onClick } = render();
    click(onClick);
    expect(back).toHaveBeenCalledOnce();
  });

  it("returning to a tagged entry: goes back", () => {
    store.set(ACCOUNT_RETURN_KEY, JSON.stringify({ token: "t1" }));
    history.state = { __NA: true, [ACCOUNT_STATE_KEY]: "t1" };
    click(render().onClick);
    expect(back).toHaveBeenCalledOnce();
  });

  it("a fresh load: follows the link to the Library", () => {
    const event = click(render().onClick);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });
});
