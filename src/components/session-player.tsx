"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AudioLines,
  ChevronDown,
  Download,
  Heart,
  MoreHorizontal,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MeditationCover } from "@/components/meditation-cover";
import { useMeditationPage } from "@/components/meditation-page";
import { SEEK_OFFSET_SECONDS } from "@/components/use-media-session";
import {
  formatTime,
  useWaveformPlayer,
} from "@/components/use-waveform-player";
import { cn } from "@/lib/utils";

interface SessionPlayerProps {
  audioUrl: string;
  meditationId: string;
  title: string;
  tags: string[];
  /** "Sleep · 20 min", under the title. */
  meta: string;
  /** Signed in: downloads, favourites and play counts. */
  isSignedIn: boolean;
  /** Whether the page has a script for "Show script" to open. */
  hasScript: boolean;
}

/**
 * The meditation page's player (task 55): one Play on the page, and a
 * session view that takes the screen while it plays.
 *
 * The view is an overlay on the page, never a route, and it stays mounted
 * while minimized: hidden, not removed. That keeps one wavesurfer and one
 * <audio> element for the life of the page, so the lock screen (task 25),
 * play counting, the download and the script sync never rebind as the view
 * opens and closes, and minimizing never interrupts the audio.
 */
export function SessionPlayer({
  audioUrl,
  meditationId,
  title,
  tags,
  meta,
  isSignedIn,
  hasScript,
}: SessionPlayerProps) {
  const player = useWaveformPlayer({
    audioUrl,
    title,
    meditationId,
    trackPlays: isSignedIn,
    shape: {
      height: 28,
      barWidth: 2,
      barGap: 2,
      barRadius: 1,
      cursorWidth: 0,
      dragToSeek: true,
    },
    hover: false,
  });
  const { containerRef, isPlaying, currentTime, duration, started, ready } = player;
  const page = useMeditationPage();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const playRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const remaining = Math.max(0, duration - currentTime);

  function openSession() {
    setOpen(true);
    if (!isPlaying) player.play();
  }

  function closeSession() {
    setOpen(false);
  }

  // While open: the page behind does not scroll, focus starts on the
  // minimize button and stays in the view, Escape minimizes, and Space plays
  // and pauses. Closing hands focus back to the Play that opened it.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    closeRef.current?.focus();
    const playButton = playRef.current;
    return () => {
      root.style.overflow = overflow;
      playButton?.focus();
    };
  }, [open]);

  const { togglePlay } = player;
  useEffect(() => {
    if (!open || menuOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      // The "…" menu handles its own keys; its Escape closes only the menu.
      // By the time this runs the menu may already have closed, so ask the
      // event where it came from rather than the menu's state.
      if (e.target instanceof Element && e.target.closest("[role=menu]")) return;
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      } else if (e.key === "Tab") {
        trapFocus(e, dialogRef.current);
      } else if (
        e.key === " " &&
        !(e.target instanceof HTMLButtonElement) &&
        !(e.target instanceof HTMLAnchorElement)
      ) {
        e.preventDefault();
        togglePlay();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, menuOpen, togglePlay]);

  function onSeekKey(e: React.KeyboardEvent) {
    const step =
      e.key === "ArrowRight" || e.key === "ArrowUp"
        ? SEEK_OFFSET_SECONDS
        : e.key === "ArrowLeft" || e.key === "ArrowDown"
          ? -SEEK_OFFSET_SECONDS
          : e.key === "Home"
            ? -Infinity
            : e.key === "End"
              ? Infinity
              : 0;
    if (!step) return;
    e.preventDefault();
    player.skip(Number.isFinite(step) ? step : step > 0 ? duration : -duration);
  }

  const downloadHref = `/api/audio/${meditationId}/download`;

  return (
    <>
      {/* Solid Primary, not the gradient: this opens the player, it is not
          the player (DESIGN.md, The One Gradient Rule). */}
      <Button
        ref={playRef}
        size="lg"
        onClick={openSession}
        aria-haspopup="dialog"
        className="h-12 w-full gap-2 text-base sm:w-auto sm:min-w-44 sm:px-8"
      >
        {!started ? (
          <>
            <Play className="size-4 fill-current" />
            Play
          </>
        ) : (
          <>
            {isPlaying ? (
              <AudioLines className="size-4" />
            ) : (
              <Play className="size-4 fill-current" />
            )}
            {isPlaying ? "Playing" : "Resume"}
            <span className="font-normal tabular-nums opacity-80">
              · {formatTime(remaining)} left
            </span>
          </>
        )}
      </Button>

      {/* Always dark: a lights-down mode for eyes closed, in either theme.
          The `dark` class re-scopes every token inside it. */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        inert={!open}
        className={cn(
          "dark fixed inset-x-0 top-0 z-50 h-dvh text-foreground",
          // Visible at once on open, so focus can land in it; hidden only
          // once the fade-out ends on close.
          open
            ? "visible opacity-100 motion-safe:transition-opacity"
            : "invisible opacity-0 motion-safe:transition-[opacity,visibility]",
          "motion-safe:duration-300",
        )}
      >
        {/* From `sm` the view is a large centred panel over a dimmed page. */}
        <div
          aria-hidden
          onClick={closeSession}
          className="absolute inset-0 hidden bg-night/80 backdrop-blur-sm sm:block"
        />
        <div
          className={cn(
            "relative flex h-full flex-col overflow-hidden bg-night sm:mx-auto sm:mt-[5dvh] sm:h-[90dvh] sm:max-h-[52rem] sm:max-w-md sm:rounded-xl sm:border",
            open ? "translate-y-0" : "translate-y-6",
            "motion-safe:transition-transform motion-safe:duration-300",
          )}
        >
          {/* The cover fills the top of the view and fades to night through
              an alpha mask, which sets only transparency and adds no hue. */}
          <MeditationCover
            id={meditationId}
            tags={tags}
            title={title}
            size={600}
            crop
            className="absolute inset-x-0 top-0 h-[72%] w-full rounded-none sm:rounded-none"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-night [mask-image:linear-gradient(to_bottom,transparent_35%,black_66%)]"
          />

          <div className="relative flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
            <RoundButton ref={closeRef} onClick={closeSession} label="Minimize">
              <ChevronDown className="size-5" />
            </RoundButton>
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <RoundButton label="More">
                  <MoreHorizontal className="size-5" />
                </RoundButton>
              </DropdownMenuTrigger>
              {/* Portalled out of the view, so it carries `dark` itself. */}
              <DropdownMenuContent align="end" className="dark min-w-48">
                <DropdownMenuItem asChild>
                  {isSignedIn ? (
                    <a href={downloadHref}>
                      <Download />
                      Download
                    </a>
                  ) : (
                    <Link href="/login">
                      <Download />
                      Sign in to download
                    </Link>
                  )}
                </DropdownMenuItem>
                {isSignedIn && page && (
                  <DropdownMenuItem
                    disabled={page.favorite.isPending}
                    onSelect={page.favorite.toggle}
                  >
                    <Heart
                      className={cn(
                        page.favorite.isFavorited && "fill-current text-primary",
                      )}
                    />
                    {page.favorite.isFavorited
                      ? "Remove from favorites"
                      : "Add to favorites"}
                  </DropdownMenuItem>
                )}
                {hasScript && page && (
                  <DropdownMenuItem
                    onSelect={() => {
                      // The script follows the audio on the page.
                      closeSession();
                      page.revealScript();
                    }}
                  >
                    <ScrollText />
                    Show script
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="relative flex flex-1 items-center justify-center gap-10">
            <SkipButton
              onClick={() => player.skip(-SEEK_OFFSET_SECONDS)}
              label={`Back ${SEEK_OFFSET_SECONDS} seconds`}
            >
              <RotateCcw className="size-9" strokeWidth={1.5} />
            </SkipButton>
            <div className="relative">
              <div
                aria-hidden
                className="player-halo pointer-events-none absolute -inset-6 -z-10 rounded-full"
              />
              <button
                type="button"
                onClick={player.togglePlay}
                aria-label={isPlaying ? "Pause" : "Play"}
                className="flex size-21 items-center justify-center rounded-full bg-linear-to-br from-gradient-start to-gradient-end text-gradient-foreground outline-none hover:brightness-110 focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-safe:transition-[filter,transform] motion-safe:active:scale-95"
              >
                {isPlaying ? (
                  <Pause className="size-8 fill-current" />
                ) : (
                  <Play className="size-8 translate-x-0.5 fill-current" />
                )}
              </button>
            </div>
            <SkipButton
              onClick={() => player.skip(SEEK_OFFSET_SECONDS)}
              label={`Forward ${SEEK_OFFSET_SECONDS} seconds`}
            >
              <RotateCw className="size-9" strokeWidth={1.5} />
            </SkipButton>
          </div>

          <div className="relative px-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
            <p
              aria-hidden
              className="font-serif text-6xl leading-none tracking-tight tabular-nums"
            >
              {formatTime(remaining)}
            </p>
            {/* The waveform is the progress bar: it shows where the silences
                are. A slider for the keyboard and screen readers. */}
            <div
              ref={containerRef}
              role="slider"
              tabIndex={0}
              aria-label="Position"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(currentTime)}
              aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
              onKeyDown={onSeekKey}
              className={cn(
                "mt-4 h-7 w-full cursor-pointer rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                !ready && "bg-muted motion-safe:animate-pulse",
              )}
            />
            <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums">
              <span>{formatTime(currentTime)}</span>
              <span>
                <span aria-hidden>−</span>
                <span className="sr-only">Remaining </span>
                {formatTime(remaining)}
              </span>
            </div>
            <h2 className="mt-5 truncate font-serif text-xl font-medium">{title}</h2>
            {meta && (
              <p className="mt-1 text-sm text-muted-foreground tabular-nums">{meta}</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function RoundButton({
  label,
  className,
  ...props
}: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "flex size-10 items-center justify-center rounded-full bg-night/55 text-foreground outline-none hover:bg-night/80 focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-safe:transition-colors",
        className,
      )}
      {...props}
    />
  );
}

/** A circular arrow with the seconds set inside it. */
function SkipButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="relative flex size-12 items-center justify-center rounded-full text-foreground outline-none hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-safe:transition-colors"
    >
      {children}
      <span
        aria-hidden
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[38%] text-[0.625rem] font-semibold tabular-nums"
      >
        {SEEK_OFFSET_SECONDS}
      </span>
    </button>
  );
}

/** Keep Tab inside `root`, wrapping at either end. */
function trapFocus(e: KeyboardEvent, root: HTMLElement | null) {
  if (!root) return;
  const focusable = Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => el.offsetParent !== null || el === document.activeElement);
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}
