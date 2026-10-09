import type { MetadataRoute } from "next";
import { GROUND_DARK } from "@/lib/brand/ground";

/**
 * The web app manifest, served at `/manifest.webmanifest`; Next adds the
 * `<link rel="manifest">` itself. It makes the app installable and nothing
 * more: there is deliberately no service worker, so no offline mode.
 *
 * iOS reads its install name and status bar from the `appleWebApp` metadata
 * in `layout.tsx`, not from here.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zenerate",
    short_name: "Zenerate",
    // The locked pitch from PRODUCT.md, verbatim.
    description: "Meditations composed for you, not picked from a catalogue.",
    // An installed app opens to the library, not the marketing page.
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    // Dark is the design target, and the icons sit on the same Midnight.
    theme_color: GROUND_DARK,
    background_color: GROUND_DARK,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
