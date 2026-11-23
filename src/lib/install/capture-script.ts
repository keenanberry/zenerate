import { IN_APP_BROWSER } from "./platform";

/**
 * Chrome fires `beforeinstallprompt` once per page load, as early as it
 * likes, and possibly before React hydrates. The root layout inlines this
 * script so the event is caught during HTML parsing and kept on `window`,
 * where the install card reads it on mount.
 *
 * It holds the event (and calls `preventDefault()`, which stops Chrome's own
 * mini-infobar) only on Android outside an in-app browser: the one place the
 * card offers an Install button. Elsewhere, a desktop or an Android tablet that
 * asks for the desktop site, Chrome keeps its own install affordances.
 */
export const PROMPT_KEY = "__zenerateInstallPrompt";
export const INSTALLED_KEY = "__zenerateInstalled";
export const INSTALL_CHANGE = "zenerate:install-change";

export const CAPTURE_SCRIPT = `(function(w){var u=navigator.userAgent||"";if(!/Android/i.test(u)||${IN_APP_BROWSER}.test(u))return;function n(){w.dispatchEvent(new Event(${JSON.stringify(
  INSTALL_CHANGE,
)}))}w.addEventListener("beforeinstallprompt",function(e){e.preventDefault();w.${PROMPT_KEY}=e;n()});w.addEventListener("appinstalled",function(){w.${PROMPT_KEY}=null;w.${INSTALLED_KEY}=true;n()})})(window)`;
