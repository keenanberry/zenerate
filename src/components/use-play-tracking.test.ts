import { describe, expect, it, vi } from "vitest";
import { PLAY_THRESHOLD_SECONDS, watchPlays } from "./use-play-tracking";

/** An element that plays in 0.25 s ticks, as timeupdate fires in a browser. */
class FakeMedia extends EventTarget {
  paused = true;
  currentTime = 0;

  play() {
    this.paused = false;
    this.dispatchEvent(new Event("play"));
  }
  pause() {
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  }
  listen(seconds: number) {
    for (let i = 0; i < seconds * 4; i++) {
      this.currentTime += 0.25;
      this.dispatchEvent(new Event("timeupdate"));
    }
  }
  seek(to: number) {
    this.currentTime = to;
    this.dispatchEvent(new Event("timeupdate"));
    this.dispatchEvent(new Event("seeked"));
  }
  end() {
    this.paused = true;
    this.dispatchEvent(new Event("ended"));
    this.currentTime = 0;
  }
}

function setup() {
  const media = new FakeMedia();
  const onPlay = vi.fn();
  const stop = watchPlays(media, onPlay);
  return { media, onPlay, stop };
}

describe("watchPlays", () => {
  it("counts nothing before the threshold", () => {
    const { media, onPlay } = setup();
    media.play();
    media.listen(PLAY_THRESHOLD_SECONDS - 1);
    expect(onPlay).not.toHaveBeenCalled();
  });

  it("counts once past the threshold, however long the play runs", () => {
    const { media, onPlay } = setup();
    media.play();
    media.listen(PLAY_THRESHOLD_SECONDS + 1);
    media.listen(300);
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it("adds up listening across a pause", () => {
    const { media, onPlay } = setup();
    media.play();
    media.listen(20);
    media.pause();
    media.play();
    media.listen(11);
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it("does not count a seek as listening", () => {
    const { media, onPlay } = setup();
    media.play();
    media.listen(5);
    media.seek(600);
    media.listen(5);
    expect(onPlay).not.toHaveBeenCalled();
  });

  it("counts each pass separately: one row per play", () => {
    const { media, onPlay } = setup();
    media.play();
    media.listen(40);
    media.end();
    media.play();
    media.listen(40);
    expect(onPlay).toHaveBeenCalledTimes(2);
  });

  it("starts a new play when a counted one restarts from the top", () => {
    const { media, onPlay } = setup();
    media.play();
    media.listen(40);
    media.pause();
    media.seek(0);
    media.play();
    media.listen(40);
    expect(onPlay).toHaveBeenCalledTimes(2);
  });

  it("stops listening after cleanup", () => {
    const { media, onPlay, stop } = setup();
    stop();
    media.play();
    media.listen(60);
    expect(onPlay).not.toHaveBeenCalled();
  });
});
