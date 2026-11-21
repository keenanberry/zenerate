"use client";

import { useRef } from "react";

/** A finger position at a moment: px from the top, ms. */
type Sample = { y: number; t: number };

/** How far back the release velocity looks, in ms. */
const VELOCITY_WINDOW_MS = 80;
/** A flick: px/ms downward, and the least distance it must have moved. */
const FLICK_VELOCITY = 0.5;
const FLICK_MIN_OFFSET = 24;
/** The spring back to rest, when motion is allowed. */
const RESTORE_TRANSITION = "transform 200ms cubic-bezier(0.32, 0.72, 0, 1)";

/**
 * What a released drag does. `offset` is px dragged down (negative is up),
 * `height` the sheet's height and `velocity` px/ms downward at release.
 * Past a third of the height closes; so does a fast flick that has moved the
 * sheet a little; anything else springs back.
 */
export function dragOutcome({
  offset,
  height,
  velocity,
}: {
  offset: number;
  height: number;
  velocity: number;
}): "close" | "restore" {
  if (offset > height / 3) return "close";
  if (velocity > FLICK_VELOCITY && offset > FLICK_MIN_OFFSET) return "close";
  return "restore";
}

/**
 * The finger's speed at release, px/ms (positive is down), measured over its
 * last ~80ms so a slow drag that ends in a flick still reads as a flick.
 */
export function releaseVelocity(samples: Sample[]): number {
  const last = samples.at(-1);
  if (!last || samples.length < 2) return 0;
  // The oldest sample inside the window. A finger held still before release
  // leaves only the last one there, and so no speed.
  const from = samples.find((s) => last.t - s.t <= VELOCITY_WINDOW_MS) ?? last;
  const dt = last.t - from.t;
  return dt > 0 ? (last.y - from.y) / dt : 0;
}

/** Controls a drag on: the handle and header, never scrollable content. */
const INTERACTIVE = "a, button, input, select, textarea, [role=button]";

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Drag a bottom sheet down to close it. Spread `handleProps` on the grab
 * handle and the sheet's header; the sheet follows the finger (never above
 * its resting place) and, on release, closes or springs back by
 * `dragOutcome`. The sheet is the nearest `[data-slot=sheet-content]`, and
 * it is moved by its inline transform rather than by React state, so a drag
 * does not re-render the sheet's content on every pointer move, and a sheet
 * reopened later mounts a fresh element at rest. Under reduced motion the
 * drag still follows the finger but the spring back is instant (the close
 * is the sheet's own exit, which `BottomSheetContent` turns off).
 */
export function useSheetDrag(onClose: () => void): {
  handleProps: React.HTMLAttributes<HTMLElement>;
} {
  const drag = useRef<{
    sheet: HTMLElement;
    pointerId: number;
    startY: number;
    offset: number;
    samples: Sample[];
  } | null>(null);

  function move(sheet: HTMLElement, offset: number) {
    sheet.style.transition = "none";
    sheet.style.transform = offset > 0 ? `translate3d(0, ${offset}px, 0)` : "";
  }

  function restore(sheet: HTMLElement, offset: number) {
    if (offset <= 0 || reducedMotion()) {
      sheet.style.transition = "";
      sheet.style.transform = "";
      return;
    }
    sheet.style.transition = RESTORE_TRANSITION;
    sheet.style.transform = "";
    sheet.addEventListener(
      "transitionend",
      () => {
        sheet.style.transition = "";
      },
      { once: true },
    );
  }

  function end(e: React.PointerEvent<HTMLElement>, cancelled: boolean) {
    const current = drag.current;
    if (!current || current.pointerId !== e.pointerId) return;
    drag.current = null;
    const { sheet, offset, samples } = current;
    const outcome = cancelled
      ? "restore"
      : dragOutcome({
          offset,
          height: sheet.getBoundingClientRect().height,
          velocity: releaseVelocity(samples),
        });

    if (outcome === "close") {
      // Leave the sheet where the finger left it: its exit animation starts
      // from the inline transform, so it carries on down from there.
      onClose();
      // A sheet may refuse (a delete in flight): then it springs back.
      requestAnimationFrame(() => {
        if (sheet.isConnected && sheet.dataset.state === "open") restore(sheet, offset);
      });
      return;
    }
    restore(sheet, offset);
  }

  return {
    handleProps: {
      // The page must not scroll, or pull to refresh, under the drag.
      style: { touchAction: "none" },
      onPointerDown(e) {
        if (e.button !== 0 || drag.current) return;
        if (e.target instanceof Element && e.target.closest(INTERACTIVE)) return;
        const sheet = e.currentTarget.closest<HTMLElement>("[data-slot=sheet-content]");
        if (!sheet) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = {
          sheet,
          pointerId: e.pointerId,
          startY: e.clientY,
          offset: 0,
          samples: [{ y: e.clientY, t: e.timeStamp }],
        };
      },
      onPointerMove(e) {
        const current = drag.current;
        if (!current || current.pointerId !== e.pointerId) return;
        current.offset = e.clientY - current.startY;
        current.samples.push({ y: e.clientY, t: e.timeStamp });
        if (current.samples.length > 20) current.samples.shift();
        move(current.sheet, current.offset);
      },
      onPointerUp: (e) => end(e, false),
      onPointerCancel: (e) => end(e, true),
    },
  };
}
