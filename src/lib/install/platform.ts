/**
 * Which way of installing Zenerate a visitor's device offers, for the install
 * prompt (the Library card and Account's "Install the app"). Pure, so it is
 * tested from user agent strings; the client hook feeds it `navigator`.
 */
export type InstallPlatform =
  /** Already running as the installed app: say nothing. */
  | "installed"
  /** Safari on iPhone or iPad: Share → Add to Home Screen → Add. */
  | "ios-safari"
  /** Chrome, Firefox, Edge and the rest on iOS: the same steps, Share elsewhere. */
  | "ios-other"
  /** Android: the browser's own Install prompt when it offers one, else its menu. */
  | "android"
  /**
   * A browser inside another app (Instagram, Facebook, TikTok, an Android
   * WebView...), which cannot add to the home screen: open Safari or Chrome first.
   */
  | "in-app"
  /** A computer: a QR code to open the site on a phone. */
  | "desktop"
  /** A phone or tablet we do not recognise: general directions. */
  | "other";

export type PlatformSignals = {
  userAgent: string;
  /** `matchMedia("(display-mode: standalone)").matches` (or fullscreen, minimal-ui). */
  displayModeStandalone: boolean;
  /** iOS Safari's own flag, `navigator.standalone`. */
  navigatorStandalone?: boolean;
  /** `navigator.maxTouchPoints`: tells an iPad, which reports a Mac, from a Mac. */
  maxTouchPoints?: number;
};

/** iOS browsers other than Safari mark themselves with these tokens. */
const IOS_OTHER_BROWSER = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|YaBrowser|DuckDuckGo/;

/**
 * Apps that open links in their own browser: Facebook and Messenger (FBAN,
 * FBAV, FB_IAB), Instagram, LinkedIn, TikTok (musical_ly, BytedanceWebview),
 * Line, WeChat (MicroMessenger), Snapchat, the Google app (GSA), and any
 * Android WebView (`; wv)`). None can add a page to the home screen. Shared
 * with the inline capture script, so it stays a plain regex literal.
 */
export const IN_APP_BROWSER =
  /FBAN|FBAV|FB_IAB|FBIOS|Messenger|Instagram|LinkedInApp|musical_ly|BytedanceWebview|TikTok|Line\/|MicroMessenger|Snapchat|GSA\/|; wv\)/;

/** iOS's WebKit without a "Safari/" token is a WKWebView inside an app. */
function iosWebView(ua: string): boolean {
  return /AppleWebKit/.test(ua) && !/Safari\//.test(ua);
}

export function detectInstallPlatform({
  userAgent,
  displayModeStandalone,
  navigatorStandalone = false,
  maxTouchPoints = 0,
}: PlatformSignals): InstallPlatform {
  if (displayModeStandalone || navigatorStandalone) return "installed";

  const ua = userAgent;
  // iPadOS 13+ Safari asks for the desktop site and says "Macintosh"; a Mac
  // has no touch points.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  if ((ios || android) && IN_APP_BROWSER.test(ua)) return "in-app";
  if (ios) {
    if (IOS_OTHER_BROWSER.test(ua)) return "ios-other";
    return iosWebView(ua) ? "in-app" : "ios-safari";
  }

  if (android) return "android";
  if (/Mobi|Tablet|Silk|KAIOS|BlackBerry|Opera Mini|IEMobile/i.test(ua)) return "other";
  if (/Windows|Macintosh|Linux|CrOS|X11/.test(ua)) return "desktop";
  return "other";
}

/** Whether an in-app browser runs on iOS (open in Safari) or not (open in Chrome). */
export function inAppOs(userAgent: string, maxTouchPoints = 0): "ios" | "android" {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
    ? "ios"
    : "android";
}

/** The iOS browser a visitor is using, to name where its Share button is. */
export function iosBrowserName(userAgent: string): string | null {
  if (/CriOS/.test(userAgent)) return "Chrome";
  if (/FxiOS/.test(userAgent)) return "Firefox";
  if (/EdgiOS/.test(userAgent)) return "Edge";
  return null;
}
