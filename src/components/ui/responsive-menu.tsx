"use client"

import * as React from "react"

import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetItem,
  BottomSheetSeparator,
  BottomSheetTrigger,
} from "@/components/ui/bottom-sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useIsDesktop } from "@/lib/use-is-desktop"

/** Set by the root, read by every part, so the parts never disagree. */
const DesktopContext = React.createContext(true)

/**
 * A menu that is a dropdown from `md` up and a bottom sheet of large rows
 * below it. A call site writes its items once; the mode follows the window.
 */
function ResponsiveMenu({
  open,
  onOpenChange,
  children,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}) {
  const desktop = useIsDesktop()
  const Root = desktop ? DropdownMenu : BottomSheet
  return (
    <DesktopContext.Provider value={desktop}>
      <Root open={open} onOpenChange={onOpenChange}>
        {children}
      </Root>
    </DesktopContext.Provider>
  )
}

function ResponsiveMenuTrigger({
  asChild,
  children,
}: {
  asChild?: boolean
  children?: React.ReactNode
}) {
  const Trigger = React.useContext(DesktopContext) ? DropdownMenuTrigger : BottomSheetTrigger
  return <Trigger asChild={asChild}>{children}</Trigger>
}

/**
 * The menu's items. On a phone the sheet's `header` names what the menu acts
 * on (a cover, the title, a meta line; the caller builds it), and `title` is
 * its accessible name. The dropdown shows neither. `onCloseAutoFocus` reaches
 * both, since that is where a menu item hands off to another layer.
 */
function ResponsiveMenuContent({
  header,
  title,
  align,
  className,
  onCloseAutoFocus,
  children,
}: {
  header?: React.ReactNode
  title: string
  align?: "start" | "center" | "end"
  className?: string
  onCloseAutoFocus?: (event: Event) => void
  children?: React.ReactNode
}) {
  if (React.useContext(DesktopContext)) {
    return (
      <DropdownMenuContent
        align={align}
        className={className}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        {children}
      </DropdownMenuContent>
    )
  }
  return (
    <BottomSheetContent
      title={title}
      header={header}
      className={className}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      {children}
    </BottomSheetContent>
  )
}

type ItemProps = {
  asChild?: boolean
  variant?: "default" | "destructive"
  disabled?: boolean
  onSelect?: (event: Event) => void
  className?: string
  children?: React.ReactNode
}

function ResponsiveMenuItem(props: ItemProps) {
  const Item = React.useContext(DesktopContext) ? DropdownMenuItem : BottomSheetItem
  return <Item {...props} />
}

function ResponsiveMenuSeparator() {
  return React.useContext(DesktopContext) ? <DropdownMenuSeparator /> : <BottomSheetSeparator />
}

export {
  ResponsiveMenu,
  ResponsiveMenuTrigger,
  ResponsiveMenuContent,
  ResponsiveMenuItem,
  ResponsiveMenuSeparator,
}
