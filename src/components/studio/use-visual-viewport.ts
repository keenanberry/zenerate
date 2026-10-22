"use client";

import { useEffect } from "react";

/**
 * Publish the visual viewport, the part of the page actually on screen, as
 * --viewport-top and --viewport-height on <html>, for the shell to pin itself
 * to. iOS opens the keyboard over the page: 100dvh and the layout viewport
 * stay the same size, and Safari pans the page to keep the focused field in
 * view. Following the visual viewport shrinks the studio instead, so the
 * composer rides on the keyboard with the conversation above it.
 */
export function useVisualViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;

    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // A pinch zoom shrinks the visual viewport too. Pinning the shell to
        // it would shrink the page under the reader's fingers.
        if (Math.abs(viewport.scale - 1) > 0.01) return;
        root.style.setProperty("--viewport-top", `${viewport.offsetTop}px`);
        root.style.setProperty("--viewport-height", `${viewport.height}px`);
      });
    };

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      root.style.removeProperty("--viewport-top");
      root.style.removeProperty("--viewport-height");
    };
  }, []);
}
