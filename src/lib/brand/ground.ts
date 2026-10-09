/**
 * The page grounds as sRGB hex, for the places that cannot read a CSS token:
 * the web app manifest and the `theme-color` meta tag. iOS and older manifest
 * parsers do not understand `oklch()`.
 *
 * These are DESIGN.md's Midnight (the dark ground) and Paper (the light one),
 * converted with the icon build's `oklchToHex`; `ground.test.ts` fails if
 * either drifts from the frontmatter. Midnight is also the full-bleed ground
 * of every icon in `public/`, so the install splash and the icon match.
 */
export const GROUND_DARK = "#1a1823";
export const GROUND_LIGHT = "#f6f3fe";
