"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      // Clear of the phone's bottom tab bar while it shows: globals.css sets
      // --bottom-bar-clearance from it (0 otherwise). Both offsets, because
      // Sonner switches to its mobile layout at 600px and the bar shows to 768px.
      offset={{ bottom: "calc(var(--bottom-bar-clearance, 0px) + 24px)" }}
      mobileOffset={{ bottom: "calc(var(--bottom-bar-clearance, 0px) + 16px)" }}
      {...props}
    />
  )
}

export { Toaster }
