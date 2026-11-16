import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Task 60: with peaks the player must hand wavesurfer its own streaming
 * element, or wavesurfer downloads the whole file on page load to decode it.
 * The suite runs in node with no DOM renderer, so React's hooks are a minimal
 * runner (effects run when flushed, cleanups on unmount) and wavesurfer and
 * the DOM are stand-ins that record what they are given.
 */
type Effect = () => void | (() => void);
const pending: Effect[] = [];
const cleanups: Array<() => void> = [];

vi.mock("react", () => ({
  useState: (init: unknown) => [typeof init === "function" ? (init as () => unknown)() : init, () => {}],
  useRef: (init: unknown) => ({ current: init }),
  useCallback: (fn: unknown) => fn,
  useEffect: (effect: Effect) => void pending.push(effect),
}));

const { created } = vi.hoisted(() => ({
  created: [] as Array<{ options: Record<string, unknown>; destroy: ReturnType<typeof vi.fn> }>,
}));
vi.mock("wavesurfer.js", () => ({
  default: {
    create: (options: Record<string, unknown>) => {
      const ws = { options, on: vi.fn(() => () => {}), destroy: vi.fn(), setOptions: vi.fn() };
      created.push(ws);
      return ws;
    },
  },
}));
vi.mock("wavesurfer.js/dist/plugins/hover.esm.js", () => ({ default: { create: () => ({}) } }));
vi.mock("@/components/use-media-session", () => ({
  useMediaSession: () => {},
  watchMediaElement: () => () => {},
}));
vi.mock("@/components/script-playback", () => ({ useReportScriptPlayback: () => null }));
vi.mock("@/components/use-play-tracking", () => ({ usePlayTracking: () => {} }));
vi.mock("@/lib/meditation/actions", () => ({ recordPlay: async () => true }));

const { useWaveformPlayer: runPlayer } = await import("./use-waveform-player");

class FakeAudio {
  preload = "auto";
  calls: string[] = [];
  pause = vi.fn(() => this.calls.push("pause"));
  removeAttribute = vi.fn((name: string) => this.calls.push(`removeAttribute:${name}`));
  load = vi.fn(() => this.calls.push("load"));
  remove = vi.fn(() => this.calls.push("remove"));
}

let audios: FakeAudio[];
let container: { clientWidth: number; appendChild: ReturnType<typeof vi.fn> };

beforeEach(() => {
  audios = [];
  created.length = 0;
  container = { clientWidth: 600, appendChild: vi.fn() };
  class Observer {
    observe() {}
    disconnect() {}
  }
  vi.stubGlobal("window", { devicePixelRatio: 2 });
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "" }));
  vi.stubGlobal("MutationObserver", Observer);
  vi.stubGlobal("ResizeObserver", Observer);
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.stubGlobal("document", {
    documentElement: {},
    createElement: (tag: string) => {
      if (tag !== "audio") return { getContext: () => null };
      const audio = new FakeAudio();
      audios.push(audio);
      return audio;
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  pending.length = 0;
  cleanups.length = 0;
});

const SHAPE = { height: 28, barWidth: 2, barGap: 2, barRadius: 1, cursorWidth: 0 };
const WAVEFORM = { peaks: [10, 60, 30], duration: 624.4 };

function mount(waveform: typeof WAVEFORM | null) {
  const player = runPlayer({
    audioUrl: "https://signed/a.mp3",
    waveform,
    title: "Patience",
    meditationId: "med-1",
    trackPlays: false,
    shape: SHAPE,
    hover: false,
  });
  (player.containerRef as { current: unknown }).current = container;
  for (const effect of pending.splice(0)) {
    const cleanup = effect();
    if (cleanup) cleanups.push(cleanup);
  }
  return { unmount: () => cleanups.splice(0).forEach((c) => c()) };
}

describe("useWaveformPlayer", () => {
  it("draws supplied peaks and streams through its own element, preloading only metadata", () => {
    mount(WAVEFORM);

    expect(created).toHaveLength(1);
    const { options } = created[0];
    expect(audios).toHaveLength(1);
    expect(options).toMatchObject({
      url: "https://signed/a.mp3",
      media: audios[0],
      peaks: [[0.1, 0.6, 0.3]],
      duration: WAVEFORM.duration,
      normalize: true,
    });
    expect(audios[0].preload).toBe("metadata");
    // In the document, as wavesurfer's own element is.
    expect(container.appendChild).toHaveBeenCalledWith(audios[0]);
  });

  it("lets wavesurfer fetch and decode the file for a render without peaks", () => {
    mount(null);

    const { options } = created[0];
    expect(options.url).toBe("https://signed/a.mp3");
    expect(options).not.toHaveProperty("media");
    expect(options).not.toHaveProperty("peaks");
    expect(options).not.toHaveProperty("duration");
    expect(audios).toHaveLength(0);
  });

  it("stops and releases its element on unmount, which wavesurfer leaves to the owner", () => {
    const { unmount } = mount(WAVEFORM);
    unmount();

    expect(created[0].destroy).toHaveBeenCalled();
    expect(audios[0].calls).toEqual(["pause", "removeAttribute:src", "load", "remove"]);
  });
});
