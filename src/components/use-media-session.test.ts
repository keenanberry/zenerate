import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MEDIA_ARTWORK,
  SEEK_OFFSET_SECONDS,
  bindMediaSession,
  clampTime,
  mediaMetadataInit,
  positionStateFor,
} from "./use-media-session";

describe("clampTime", () => {
  it("keeps a time inside the range", () => {
    expect(clampTime(42, 600)).toBe(42);
  });

  it("clamps below zero and past the end", () => {
    expect(clampTime(-10, 600)).toBe(0);
    expect(clampTime(615, 600)).toBe(600);
  });

  it("only floors at zero while the duration is unknown", () => {
    expect(clampTime(615, NaN)).toBe(615);
    expect(clampTime(-1, Infinity)).toBe(0);
  });
});

describe("positionStateFor", () => {
  it("is null until the duration is known", () => {
    expect(
      positionStateFor({ duration: NaN, currentTime: 0, playbackRate: 1 }),
    ).toBeNull();
    expect(
      positionStateFor({ duration: Infinity, currentTime: 0, playbackRate: 1 }),
    ).toBeNull();
    expect(
      positionStateFor({ duration: 0, currentTime: 0, playbackRate: 1 }),
    ).toBeNull();
  });

  it("never reports a position past the end", () => {
    expect(
      positionStateFor({ duration: 300, currentTime: 300.2, playbackRate: 1 }),
    ).toEqual({ duration: 300, position: 300, playbackRate: 1 });
  });

  it("never reports a zero rate, which setPositionState rejects", () => {
    expect(
      positionStateFor({ duration: 300, currentTime: 10, playbackRate: 0 }),
    ).toEqual({ duration: 300, position: 10, playbackRate: 1 });
  });
});

describe("mediaMetadataInit", () => {
  it("carries the title, the app name and both icon sizes", () => {
    expect(mediaMetadataInit("Body Scan")).toEqual({
      title: "Body Scan",
      artist: "Zenerate",
      artwork: MEDIA_ARTWORK,
    });
    expect(MEDIA_ARTWORK.map((a) => a.src)).toEqual([
      "/icon-192.png",
      "/icon-512.png",
    ]);
  });
});

/** Just enough of HTMLMediaElement for the session to drive. */
class FakeMedia extends EventTarget {
  paused = true;
  currentTime = 100;
  duration = 600;
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
  metadata: unknown = null;
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

describe("bindMediaSession", () => {
  let session: FakeSession;
  let media: FakeMedia;
  let unbind: () => void;

  beforeEach(() => {
    vi.stubGlobal(
      "MediaMetadata",
      class {
        constructor(init: MediaMetadataInit) {
          Object.assign(this, init);
        }
      },
    );
    session = new FakeSession();
    media = new FakeMedia();
    unbind = bindMediaSession(
      session as unknown as MediaSession,
      media as unknown as HTMLMediaElement,
      "Evening Wind-Down",
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sets the metadata and the initial paused state", () => {
    expect(session.metadata).toMatchObject({
      title: "Evening Wind-Down",
      artist: "Zenerate",
    });
    expect(session.playbackState).toBe("paused");
    expect(session.setPositionState).toHaveBeenCalledWith({
      duration: 600,
      position: 100,
      playbackRate: 1,
    });
  });

  it("wires play, pause and the seeks, and leaves the track skips unset", () => {
    expect([...session.handlers.keys()].sort()).toEqual(
      ["pause", "play", "seekbackward", "seekforward", "seekto"].sort(),
    );
    expect(session.handlers.has("previoustrack")).toBe(false);
    expect(session.handlers.has("nexttrack")).toBe(false);
  });

  it("drives the element and keeps playbackState in step with it", () => {
    session.fire("play");
    expect(media.play).toHaveBeenCalled();
    expect(session.playbackState).toBe("playing");

    session.fire("pause");
    expect(media.pause).toHaveBeenCalled();
    expect(session.playbackState).toBe("paused");
  });

  it("follows playback started from the page's own button", () => {
    media.paused = false;
    media.dispatchEvent(new Event("play"));
    expect(session.playbackState).toBe("playing");
  });

  it("skips by 15 seconds unless the OS asks for another offset", () => {
    session.fire("seekforward");
    expect(media.currentTime).toBe(100 + SEEK_OFFSET_SECONDS);
    session.fire("seekbackward");
    expect(media.currentTime).toBe(100);
    session.fire("seekbackward", { seekOffset: 30 });
    expect(media.currentTime).toBe(70);
  });

  it("clamps skips at both ends", () => {
    media.currentTime = 5;
    session.fire("seekbackward");
    expect(media.currentTime).toBe(0);
    media.currentTime = 595;
    session.fire("seekforward");
    expect(media.currentTime).toBe(600);
  });

  it("seeks to an absolute time from the lock-screen scrubber", () => {
    session.fire("seekto", { seekTime: 321 });
    expect(media.currentTime).toBe(321);
  });

  it("swallows a refused play() rather than leaving a rejection", async () => {
    media.play.mockRejectedValueOnce(new DOMException("", "NotAllowedError"));
    expect(() => session.fire("play")).not.toThrow();
    await Promise.resolve();
  });

  it("unbinds everything, so a disposed player keeps no controls", () => {
    unbind();
    expect(session.handlers.size).toBe(0);
    expect(session.metadata).toBeNull();
    expect(session.playbackState).toBe("none");

    media.paused = false;
    media.dispatchEvent(new Event("play"));
    expect(session.playbackState).toBe("none");
  });

  it("survives a browser that rejects an action it does not support", () => {
    const strict = new FakeSession();
    strict.setActionHandler = (action) => {
      if (action === "seekto") throw new TypeError("unsupported");
    };
    expect(() =>
      bindMediaSession(
        strict as unknown as MediaSession,
        media as unknown as HTMLMediaElement,
        "x",
      )(),
    ).not.toThrow();
  });
});
