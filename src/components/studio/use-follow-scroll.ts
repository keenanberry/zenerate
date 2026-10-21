"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/** How close to the bottom still counts as "at the bottom", in px. */
const SLACK = 48;

/**
 * Keep a scroll container pinned to its newest content, the way chat apps
 * do: it follows while the reader is at the bottom, stops the moment they
 * scroll up, and resumes when they scroll back down. Growth is watched on
 * the content element, so streaming text is followed without a re-render.
 */
export function useFollowScroll(
  scrollRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  initialFollow = true,
) {
  const followingRef = useRef(initialFollow);
  const [following, setFollowing] = useState(initialFollow);

  const setFollow = useCallback((value: boolean) => {
    followingRef.current = value;
    setFollowing(value);
  }, []);

  const scrollToEnd = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setFollow(true);
  }, [scrollRef, setFollow]);

  useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content) return;

    let lastTop = el.scrollTop;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= SLACK;
      // Only an upward scroll lets go. Content growing under a pinned view
      // moves the bottom away without the reader doing anything.
      if (el.scrollTop < lastTop && !atBottom) setFollow(false);
      else if (atBottom && !followingRef.current) setFollow(true);
      lastTop = el.scrollTop;
    };
    const observer = new ResizeObserver(() => {
      if (followingRef.current) {
        el.scrollTop = el.scrollHeight;
        lastTop = el.scrollTop;
      }
    });

    el.addEventListener("scroll", onScroll, { passive: true });
    observer.observe(content);
    return () => {
      el.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [scrollRef, contentRef, setFollow]);

  return { following, scrollToEnd };
}
