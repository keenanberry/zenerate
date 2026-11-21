"use client"

import * as React from "react"

import { BottomSheet, BottomSheetContent } from "@/components/ui/bottom-sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useIsDesktop } from "@/lib/use-is-desktop"

/**
 * A dialog that is centred from `md` up and a bottom sheet below it. The
 * same title, description, body and actions in both; on a phone the actions
 * are full-width buttons stacked at the bottom, the first one lowest, as the
 * dialog's footer orders them below `sm`.
 */
function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  footer,
  followKeyboard = false,
  showCloseButton = true,
  className,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  footer?: React.ReactNode
  /** For a dialog with a text field: on a phone, keep it above the iOS keyboard. */
  followKeyboard?: boolean
  /** The dialog's corner close button; a sheet closes by drag, tap outside or Escape. */
  showCloseButton?: boolean
  /** The centred dialog's classes (its width, say); the sheet is full width. */
  className?: string
  children?: React.ReactNode
}) {
  const desktop = useIsDesktop()

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={className} showCloseButton={showCloseButton}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {children}
          {footer && <DialogFooter>{footer}</DialogFooter>}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent
        title={title}
        description={description}
        followKeyboard={followKeyboard}
      >
        {children}
        {footer && (
          <div className="mt-6 flex flex-col-reverse gap-2 *:h-12 *:w-full">{footer}</div>
        )}
      </BottomSheetContent>
    </BottomSheet>
  )
}

export { ResponsiveDialog }
