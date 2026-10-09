import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The suite runs in node with no DOM renderer, so React's useEffect is
 * replaced by a minimal runner with the same contract the hook relies on: run
 * on mount, clean up and re-run when a dependency changes (Object.is), clean
 * up on unmount.
 */
type Effect = () => void | (() => void);
const slot: { deps?: unknown[]; cleanup?: void | (() => void) } = {};

vi.mock("react", () => ({
  useEffect(effect: Effect, deps: unknown[]) {
    const changed =
      !slot.deps ||
      deps.length !== slot.deps.length ||
      deps.some((d, i) => !Object.is(d, slot.deps![i]));
    if (!changed) return;
    slot.cleanup?.();
    slot.deps = deps;
    slot.cleanup = effect();
  },
}));

const { useMediaSession: runHook, watchMediaElement } = await import(
  "./use-media-session"
);

function renderHook(media: HTMLMediaElement | null, title: string) {
  runHook(media, title);
  return {
    rerender: (m: HTMLMediaElement | null, t: string) => runHook(m, t),
    unmount: () => {
      slot.cleanup?.();
      slot.cleanup = undefined;
      slot.deps = undefined;
    },
  };
}

class FakeMedia extends EventTarget {
  paused = true;
  currentTime = 0;
  duration = 300;
  playbackRate = 1;
  play = vi.fn(async () => {
    this.paused = false;
    this.dispatchEvent(new Event("play"));
  });
  pause = vi.fn(() => {
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  });
}

class FakeSession {
  metadata: { title?: string } | null = null;
  playbackState: MediaSessionPlaybackState = "none";
  handlers = new Map<string, MediaSessionActionHandler>();
  setPositionState = vi.fn();
  setActionHandler(action: string, handler: MediaSessionActionHandler | null) {
    if (handler) this.handlers.set(action, handler);
    else this.handlers.delete(action);
  }
  fire(action: MediaSessionAction, details: Partial<MediaSessionActionDetails> = {}) {
    this.handlers.get(action)!({ action, ...details });
  }
}

/** Just enough of wavesurfer's emitter for watchMediaElement. */
class FakeWaveSurfer {
  private listeners = new Map<string, Set<() => void>>();
  constructor(private media: FakeMedia) {}
  on(event: string, fn: () => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
    return () => this.listeners.get(event)!.delete(fn);
  }
  emit(event: string) {
    this.listeners.get(event)?.forEach((fn) => fn());
  }
  getMediaElement() {
    return this.media as unknown as HTMLMediaElement;
  }
  listenerCount() {
    return [...this.listeners.values()].reduce((n, s) => n + s.size, 0);
  }
}

const asMedia = (m: FakeMedia) => m as unknown as HTMLMediaElement;

let session: FakeSession;

beforeEach(() => {
  slot.deps = slot.cleanup = undefined;
  session = new FakeSession();
  vi.stubGlobal("navigator", { mediaSession: session });
  vi.stubGlobal(
    "MediaMetadata",
    class {
      constructor(init: MediaMetadataInit) {
        Object.assign(this, init);
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useMediaSession feature detection", () => {
  it("does nothing and does not throw where mediaSession is absent", () => {
    vi.stubGlobal("navigator", {});
    const media = new FakeMedia();
    expect(() => renderHook(asMedia(media), "Body Scan").unmount()).not.toThrow();
  });

  it("does nothing where there is no navigator at all", () => {
    vi.stubGlobal("navigator", undefined);
    expect(() => renderHook(asMedia(new FakeMedia()), "x").unmount()).not.toThrow();
  });

  it("does nothing until the player has an element", () => {
    renderHook(null, "Body Scan");
    expect(session.metadata).toBeNull();
    expect(session.handlers.size).toBe(0);
  });
});

describe("useMediaSession lifecycle", () => {
  it("binds on mount and clears everything on unmount", () => {
    const media = new FakeMedia();
    const hook = renderHook(asMedia(media), "Body Scan");
    expect(session.metadata?.title).toBe("Body Scan");
    expect(session.handlers.size).toBe(5);
    expect(session.playbackState).toBe("paused");

    hook.unmount();
    expect(session.metadata).toBeNull();
    expect(session.handlers.size).toBe(0);
    expect(session.playbackState).toBe("none");
  });

  it("rebinds to the new element when the meditation changes", () => {
    const first = new FakeMedia();
    const second = new FakeMedia();
    const hook = renderHook(asMedia(first), "Morning Calm");
    hook.rerender(asMedia(second), "Evening Wind-Down");

    expect(session.metadata?.title).toBe("Evening Wind-Down");

    // The lock-screen controls drive the new player, never the old one.
    session.fire("play");
    expect(second.play).toHaveBeenCalledTimes(1);
    expect(first.play).not.toHaveBeenCalled();

    // The disposed element no longer moves playbackState.
    first.paused = true;
    first.dispatchEvent(new Event("pause"));
    expect(session.playbackState).toBe("playing");
  });

  it("does not rebind on an unrelated re-render", () => {
    const media = new FakeMedia();
    const hook = renderHook(asMedia(media), "Body Scan");
    const play = session.handlers.get("play");
    hook.rerender(asMedia(media), "Body Scan");
    expect(session.handlers.get("play")).toBe(play);
  });
});

describe("watchMediaElement with wavesurfer", () => {
  it("reports wavesurfer's element on ready and null on destroy", () => {
    const media = new FakeMedia();
    const ws = new FakeWaveSurfer(media);
    const onChange = vi.fn();
    watchMediaElement(ws as never, onChange);

    ws.emit("ready");
    expect(onChange).toHaveBeenLastCalledWith(media);
    ws.emit("destroy");
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("unsubscribes both listeners", () => {
    const ws = new FakeWaveSurfer(new FakeMedia());
    const off = watchMediaElement(ws as never, vi.fn());
    expect(ws.listenerCount()).toBe(2);
    off();
    expect(ws.listenerCount()).toBe(0);
  });

  it("drives the whole chain: ready, OS play/pause/seek, destroy", () => {
    const media = new FakeMedia();
    const ws = new FakeWaveSurfer(media);
    let current: HTMLMediaElement | null = null;
    const hook = renderHook(current, "Long Silence");
    watchMediaElement(ws as never, (m) => {
      current = m;
      hook.rerender(current, "Long Silence");
    });

    ws.emit("ready");
    expect(session.metadata?.title).toBe("Long Silence");

    session.fire("play");
    expect(session.playbackState).toBe("playing");
    session.fire("seekforward");
    expect(media.currentTime).toBe(15);
    session.fire("seekbackward");
    expect(media.currentTime).toBe(0);
    session.fire("pause");
    expect(session.playbackState).toBe("paused");

    ws.emit("destroy");
    expect(session.handlers.size).toBe(0);
    expect(session.metadata).toBeNull();
  });
});
