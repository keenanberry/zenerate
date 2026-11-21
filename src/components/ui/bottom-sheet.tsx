"use client"

import * as React from "react"
import { Slot } from "radix-ui"

import { useVisualViewport } from "@/components/studio/use-visual-viewport"
import { useSheetDrag } from "@/components/ui/sheet-drag"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

/** How a sheet's parts close it: a row once chosen, the handle once dragged. */
const CloseContext = React.createContext<() => void>(() => {})

/**
 * A sheet that rises from the bottom of a phone's screen (DESIGN.md,
 * Elevation). The Radix `Sheet`, open controlled or not, with a way for its
 * rows and its drag handle to close it.
 */
function BottomSheet({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  children,
}: {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}) {
  const [ownOpen, setOwnOpen] = React.useState(defaultOpen)
  const open = openProp ?? ownOpen
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) setOwnOpen(next)
      onOpenChange?.(next)
    },
    [openProp, onOpenChange]
  )
  const close = React.useCallback(() => setOpen(false), [setOpen])

  return (
    <CloseContext.Provider value={close}>
      <Sheet open={open} onOpenChange={setOpen}>
        {children}
      </Sheet>
    </CloseContext.Provider>
  )
}

/** The grab bar at the top of a sheet: 36×4px in a 24px strip. */
function SheetHandle({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      data-sheet-handle
      {...props}
      className={cn("flex h-6 shrink-0 items-center justify-center", className)}
    >
      <div className="h-1 w-9 rounded-full bg-border" />
    </div>
  )
}

/**
 * Publishes the visual viewport while mounted, which is while the sheet is
 * open: Radix mounts a sheet's content only then.
 */
function FollowKeyboard() {
  useVisualViewport()
  return null
}

/**
 * Where a sheet with a text field sits: on the bottom of the visual
 * viewport, so iOS's keyboard pushes it up instead of covering the field,
 * and no taller than 85% of what is left on screen.
 */
const KEYBOARD_STYLE: React.CSSProperties = {
  bottom:
    "max(0px, calc(100dvh - var(--viewport-top, 0px) - var(--viewport-height, 100dvh)))",
  maxHeight: "calc(var(--viewport-height, 100dvh) * 0.85)",
}

function BottomSheetContent({
  title,
  description,
  header,
  followKeyboard = false,
  className,
  children,
  onCloseAutoFocus,
}: {
  /** The sheet's accessible name; shown as its heading unless `header` is given. */
  title: React.ReactNode
  description?: React.ReactNode
  /** What the sheet acts on (a cover, a title, a meta line), shown in place of `title`. */
  header?: React.ReactNode
  /** For a sheet with a text field: keep it above the iOS keyboard. */
  followKeyboard?: boolean
  className?: string
  children?: React.ReactNode
  onCloseAutoFocus?: (event: Event) => void
}) {
  const close = React.useContext(CloseContext)
  const { handleProps } = useSheetDrag(close)

  return (
    <SheetContent
      side="bottom"
      showCloseButton={false}
      onCloseAutoFocus={onCloseAutoFocus}
      // Without a description Radix would warn; the title names the sheet.
      {...(description ? {} : { "aria-describedby": undefined })}
      style={followKeyboard ? KEYBOARD_STYLE : undefined}
      className={cn(
        "max-h-[85dvh] gap-0 rounded-t-2xl bg-popover p-0 text-popover-foreground outline-none",
        "motion-reduce:animate-none motion-reduce:transition-none",
        className
      )}
    >
      {followKeyboard && <FollowKeyboard />}
      {/* The handle and the header drag the sheet; the rows below scroll. */}
      <div {...handleProps} className="shrink-0 px-4 pb-2 select-none">
        <SheetHandle />
        {header ? (
          <>
            <SheetTitle className="sr-only">{title}</SheetTitle>
            <div className="pt-1 pb-2">{header}</div>
          </>
        ) : (
          <SheetTitle className="pt-1 text-lg leading-snug font-semibold">
            {title}
          </SheetTitle>
        )}
        {description && (
          <SheetDescription className="mt-2 text-sm text-muted-foreground">
            {description}
          </SheetDescription>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
        {children}
      </div>
    </SheetContent>
  )
}

/**
 * One row of a menu sheet: full width, at least 52px, the icon in Dusk on
 * the left. Like a menu item, choosing it runs `onSelect` and then closes
 * the sheet, unless `onSelect` called `event.preventDefault()` (a two-tap
 * confirm keeps the sheet open).
 */
function BottomSheetItem({
  asChild = false,
  variant = "default",
  disabled,
  onSelect,
  className,
  children,
}: {
  asChild?: boolean
  variant?: "default" | "destructive"
  disabled?: boolean
  onSelect?: (event: Event) => void
  className?: string
  children?: React.ReactNode
}) {
  const close = React.useContext(CloseContext)
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="bottom-sheet-item"
      data-variant={variant}
      {...(asChild ? { "aria-disabled": disabled || undefined } : { type: "button", disabled })}
      onClick={(e: React.MouseEvent) => {
        if (disabled) {
          e.preventDefault()
          return
        }
        const select = new Event("select", { cancelable: true })
        onSelect?.(select)
        if (!select.defaultPrevented) close()
      }}
      className={cn(
        "-mx-2 flex min-h-13 w-[calc(100%+1rem)] items-center gap-4 rounded-md px-2 text-left text-base text-foreground outline-none select-none",
        "hover:bg-menu-hover focus-visible:bg-menu-hover active:bg-menu-hover motion-safe:transition-colors",
        "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5 [&_svg:not([class*='text-'])]:text-muted-foreground",
        variant === "destructive" &&
          "text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10 *:[svg]:!text-destructive",
        className
      )}
    >
      {children}
    </Comp>
  )
}

/**
 * The head of a menu sheet, naming what its rows act on: the artwork at 48px
 * where there is one, the title in Lora, and a Dusk meta line.
 */
function BottomSheetHeader({
  art,
  title,
  meta,
}: {
  art?: React.ReactNode
  title: React.ReactNode
  meta?: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {art && <div className="size-12 shrink-0 overflow-hidden rounded-md">{art}</div>}
      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-base leading-snug font-medium">{title}</p>
        {meta && (
          <p className="truncate text-sm text-muted-foreground tabular-nums">{meta}</p>
        )}
      </div>
    </div>
  )
}

/** A Hairline between groups of rows. */
function BottomSheetSeparator({ className }: { className?: string }) {
  return <div role="separator" className={cn("my-1 h-px bg-border", className)} />
}

/** Opens the sheet it sits in; the Radix trigger, `asChild` as usual. */
const BottomSheetTrigger = SheetTrigger

export {
  BottomSheet,
  BottomSheetTrigger,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetItem,
  BottomSheetSeparator,
  SheetHandle,
}
