import { useMemo } from "react";
import {
  EllipsisVertical,
  ExternalLink,
  Share,
  Smartphone,
  SquarePlus,
  type LucideIcon,
} from "lucide-react";
import { encodeQr, qrPath } from "@/lib/qr";
import type { InstallPlatform } from "@/lib/install/platform";

/**
 * What the install sheet says, per platform (Library card and Account row).
 * Presentational: the platform, the browser and whether Chrome's own prompt is
 * ready come in as props, so each variant renders on the server in tests.
 */

export function installTitle(platform: InstallPlatform | null, canPrompt: boolean): string {
  if (platform === "installed") return "You have the app";
  if (platform === "desktop") return "Zenerate is best on your phone";
  if (platform === "android" && canPrompt) return "Install Zenerate";
  if (platform === "in-app") return "Open Zenerate in your browser first";
  return "Add Zenerate to your home screen";
}

type Step = {
  /** The illustration: a lucide icon matching the browser's own, or a word on a button. */
  icon: LucideIcon | string;
  title: React.ReactNode;
  detail: React.ReactNode;
};

function iosSteps(browser: string | null, safari: boolean): Step[] {
  const where = safari
    ? "In Safari's toolbar, or under ⋯ beside the address bar."
    : browser === "Chrome"
      ? "In Chrome it is in the address bar, at the top right."
      : browser
        ? `In ${browser}, open the menu first; Share is inside it.`
        : "In your browser's address bar or its menu.";
  return [
    { icon: Share, title: <>Tap <b className="font-medium">Share</b></>, detail: where },
    {
      icon: SquarePlus,
      title: <>Choose <b className="font-medium">Add to Home Screen</b></>,
      detail: "Scroll down the list if you don't see it.",
    },
    {
      icon: "Add",
      title: <>Tap <b className="font-medium">Add</b></>,
      detail: "Zenerate is on your home screen, and opens full screen.",
    },
  ];
}

const ANDROID_STEPS: Step[] = [
  {
    icon: EllipsisVertical,
    title: <>Open the ⋮ menu</>,
    detail: "Your browser's main menu. In Samsung Internet it is ≡.",
  },
  {
    icon: Smartphone,
    title: <>Choose <b className="font-medium">Install app</b></>,
    detail: (
      <>
        Some browsers call it <b className="font-medium">Add to Home screen</b>.
      </>
    ),
  },
  {
    icon: "Install",
    title: <>Tap <b className="font-medium">Install</b></>,
    detail: "Zenerate is on your home screen, and opens full screen.",
  },
];

function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-5">
      {steps.map(({ icon: Icon, title, detail }, i) => (
        <li key={i} className="flex items-start gap-4">
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-xl border bg-card text-primary"
          >
            {typeof Icon === "string" ? (
              <span className="text-sm font-medium">{Icon}</span>
            ) : (
              <Icon className="size-6" strokeWidth={1.75} />
            )}
          </span>
          <div className="min-w-0 space-y-1 pt-1">
            <p className="text-base">
              <span className="sr-only">Step {i + 1}: </span>
              {title}
            </p>
            <p className="text-sm text-muted-foreground">{detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * The site's origin as a QR code. Dark modules on a light tile in both themes,
 * since not every camera reads a code drawn light on dark: the light theme's
 * card is white and its text Ink; in dark the tile takes Moonlit and the
 * modules Midnight.
 */
export function SiteQrCode({ url, className }: { url: string; className?: string }) {
  const code = useMemo(() => {
    try {
      const matrix = encodeQr(url);
      return { path: qrPath(matrix, 4), size: matrix.length + 8 };
    } catch {
      // Too long to encode: the written-out link beside it is enough.
      return null;
    }
  }, [url]);
  if (!code) return null;
  const { path, size } = code;
  return (
    <svg
      role="img"
      aria-label={`QR code for ${url}`}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={`rounded-xl border bg-card text-card-foreground dark:bg-foreground dark:text-background ${className ?? ""}`}
    >
      <path d={path} fill="currentColor" />
    </svg>
  );
}

/** The site's address as people would type it: no scheme, no trailing slash. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function inAppSteps(os: "ios" | "android"): Step[] {
  const browser = os === "ios" ? "Safari" : "Chrome";
  return [
    {
      icon: ExternalLink,
      title: (
        <>
          Open this page in <b className="font-medium">{browser}</b>
        </>
      ),
      detail: `This app's own browser can't add Zenerate to your home screen. In its ⋯ or share menu, choose Open in ${browser} (or Open in browser).`,
    },
    {
      icon: os === "ios" ? SquarePlus : Smartphone,
      title: <>Then add it to your home screen</>,
      detail: `In ${browser}, the Library's Show me how gives the steps.`,
    },
  ];
}

export function InstallInstructions({
  platform,
  browser = null,
  os = "ios",
  canPrompt = false,
  siteUrl,
}: {
  platform: InstallPlatform | null;
  /** The iOS browser's name, for "ios-other". */
  browser?: string | null;
  /** Which system an in-app browser runs on, for "in-app". */
  os?: "ios" | "android";
  canPrompt?: boolean;
  siteUrl: string;
}) {
  switch (platform) {
    case "in-app": {
      const library = new URL("/library", siteUrl).href;
      return (
        <div className="space-y-6">
          <Steps steps={inAppSteps(os)} />
          <p className="text-sm text-muted-foreground">
            Or type{" "}
            <a href={library} className="font-medium text-primary underline-offset-4 hover:underline">
              {displayUrl(library)}
            </a>{" "}
            into {os === "ios" ? "Safari" : "Chrome"}.
          </p>
        </div>
      );
    }
    case "installed":
      return (
        <p className="text-base text-muted-foreground">
          You&apos;re using the installed app on this device. Sessions open full screen and
          play from the lock screen.
        </p>
      );
    case "ios-safari":
      return <Steps steps={iosSteps(null, true)} />;
    case "ios-other":
      return <Steps steps={iosSteps(browser, false)} />;
    case "android":
      return canPrompt ? (
        <p className="text-base text-muted-foreground">
          Your browser can add Zenerate to your home screen. It opens full screen, straight
          to your Library.
        </p>
      ) : (
        <Steps steps={ANDROID_STEPS} />
      );
    case "desktop":
      return (
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          <SiteQrCode url={siteUrl} className="size-40 shrink-0" />
          <div className="space-y-3 text-center sm:text-left">
            <p className="text-base">
              Scan this with your phone&apos;s camera to open Zenerate there, then add it to
              your home screen.
            </p>
            <p className="text-sm text-muted-foreground">
              Or type{" "}
              <a
                href={siteUrl}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {displayUrl(siteUrl)}
              </a>{" "}
              into your phone&apos;s browser.
            </p>
          </div>
        </div>
      );
    default:
      return (
        <p className="text-base text-muted-foreground">
          Open your browser&apos;s menu or its Share button, and choose{" "}
          <b className="font-medium text-foreground">Add to Home Screen</b> or{" "}
          <b className="font-medium text-foreground">Install</b>. Zenerate then opens from your
          home screen, full screen.
        </p>
      );
  }
}
