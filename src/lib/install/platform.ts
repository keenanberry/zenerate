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
const IOS_OTHER_BROWSER = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|YaBrowser|DuckDuckGo|GSA\/|FBAN|FBAV|Instagram|Line\//;

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
  if (ios) return IOS_OTHER_BROWSER.test(ua) ? "ios-other" : "ios-safari";

  if (/Android/i.test(ua)) return "android";
  if (/Mobi|Tablet|Silk|KAIOS|BlackBerry|Opera Mini|IEMobile/i.test(ua)) return "other";
  if (/Windows|Macintosh|Linux|CrOS|X11/.test(ua)) return "desktop";
  return "other";
}

/** The iOS browser a visitor is using, to name where its Share button is. */
export function iosBrowserName(userAgent: string): string | null {
  if (/CriOS/.test(userAgent)) return "Chrome";
  if (/FxiOS/.test(userAgent)) return "Firefox";
  if (/EdgiOS/.test(userAgent)) return "Edge";
  return null;
}
