import { IN_APP_BROWSER } from "./platform";

/**
 * The install prompt's inline `<head>` script, in the root layout so it runs
 * on every full page load during HTML parsing: before first paint and before
 * React hydrates. It does two things.
 *
 * 1. It marks the installed app: `data-standalone` on `<html>` when
 *    `navigator.standalone` is true (iOS home-screen apps) or the display mode
 *    is standalone or fullscreen. The `standalone:` variant keys on that
 *    marker, so the Library's install card is hidden in the installed app's
 *    first frame. `@media (display-mode: standalone)` alone is not enough:
 *    iOS does not reliably report it (WebKit bug 264218 reports fullscreen).
 *
 * 2. It catches Chrome's `beforeinstallprompt`, which fires once per page
 *    load and possibly before hydration, and keeps it on `window` for the
 *    card's Install button. Only on Android outside an in-app browser, the one
 *    place the card offers that button. It calls `preventDefault()`, holding
 *    back Chrome's own mini-infobar, only when a Supabase session cookie says
 *    someone is signed in, i.e. only where the card can show instead; a
 *    signed-out visitor keeps Chrome's infobar.
 */
export const PROMPT_KEY = "__zenerateInstallPrompt";
export const INSTALLED_KEY = "__zenerateInstalled";
export const INSTALL_CHANGE = "zenerate:install-change";
export const STANDALONE_ATTR = "data-standalone";

/** A Supabase session cookie, `sb-<project>-auth-token`, chunked or not. */
export const SESSION_COOKIE = /(?:^|;\s*)sb-[^=;]*-auth-token(?:\.\d+)?=/;

export const INSTALL_HEAD_SCRIPT = `(function(w,d){try{var n=navigator,m=function(q){return w.matchMedia&&w.matchMedia(q).matches};if(n.standalone===true||m("(display-mode: standalone)")||m("(display-mode: fullscreen)"))d.documentElement.setAttribute(${JSON.stringify(
  STANDALONE_ATTR,
)},"")}catch(x){}var u=navigator.userAgent||"";if(!/Android/i.test(u)||${IN_APP_BROWSER}.test(u))return;function f(){w.dispatchEvent(new Event(${JSON.stringify(
  INSTALL_CHANGE,
)}))}w.addEventListener("beforeinstallprompt",function(e){if(${SESSION_COOKIE}.test(d.cookie))e.preventDefault();w.${PROMPT_KEY}=e;f()});w.addEventListener("appinstalled",function(){w.${PROMPT_KEY}=null;w.${INSTALLED_KEY}=true;f()})})(window,document)`;
