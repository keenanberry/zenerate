"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/** How close to the bottom still counts as "at the bottom", in px. */
const SLACK = 48;

/** Room left above an anchor scrolled to the top, in px. */
const ANCHOR_GAP = 16;

/**
 * Keep a scroll container pinned to its newest content, the way chat apps
 * do: it follows while the reader is at the bottom, stops the moment they
 * scroll up, and resumes when they scroll back down. Growth is watched on
 * the content element, so streaming text is followed without a re-render.
 *
 * An element marked `data-follow-anchor` (the audio card's offer) is the
 * exception. When one appears while following, the view stops at its top
 * rather than its bottom, so a tall card is read from the top. Until the
 * person touches, scrolls or types, the view keeps that place as the card
 * finishes loading; after that it stays put while the card grows, so
 * opening a list inside it does not scroll the list away. Following
 * resumes on `scrollToEnd`, when the person sends something.
 */
export function useFollowScroll(
  scrollRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  initialFollow = true,
) {
  const followingRef = useRef(initialFollow);
  const [following, setFollowing] = useState(initialFollow);
  // The newest anchor seen, and how it holds the view: "settling" keeps its
  // top in place while it loads, "held" only stops following.
  const anchorRef = useRef<Element | null>(null);
  const holdRef = useRef<"settling" | "held" | null>(null);

  const setFollow = useCallback((value: boolean) => {
    followingRef.current = value;
    setFollowing(value);
  }, []);

  const scrollToEnd = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    holdRef.current = null;
    el.scrollTop = el.scrollHeight;
    setFollow(true);
  }, [scrollRef, setFollow]);

  useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content) return;

    let lastTop = el.scrollTop;
    // Its top, or the bottom when the whole of it fits below that.
    const showAnchor = (anchor: Element) => {
      const top = anchor.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
      el.scrollTop = Math.min(top - ANCHOR_GAP, el.scrollHeight - el.clientHeight);
      lastTop = el.scrollTop;
    };
    const settle = () => {
      if (holdRef.current === "settling") holdRef.current = "held";
    };
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= SLACK;
      // Any scroll of the person's own ends an anchor's settling.
      if (el.scrollTop !== lastTop) settle();
      // Only an upward scroll lets go. Content growing under a pinned view
      // moves the bottom away without the reader doing anything.
      if (el.scrollTop < lastTop && !atBottom) setFollow(false);
      else if (atBottom && !followingRef.current) setFollow(true);
      lastTop = el.scrollTop;
    };
    const observer = new ResizeObserver(() => {
      const anchors = content.querySelectorAll("[data-follow-anchor]");
      const anchor = anchors[anchors.length - 1] ?? null;
      if (anchor !== anchorRef.current) {
        anchorRef.current = anchor;
        holdRef.current = null;
        if (anchor && followingRef.current) {
          holdRef.current = "settling";
          setFollow(false);
        }
      }
      if (anchor && holdRef.current === "settling") {
        showAnchor(anchor);
      } else if (followingRef.current && !holdRef.current) {
        el.scrollTop = el.scrollHeight;
        lastTop = el.scrollTop;
      }
    });

    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("pointerdown", settle);
    el.addEventListener("keydown", settle);
    observer.observe(content);
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("pointerdown", settle);
      el.removeEventListener("keydown", settle);
      observer.disconnect();
    };
  }, [scrollRef, contentRef, setFollow]);

  return { following, scrollToEnd };
}
