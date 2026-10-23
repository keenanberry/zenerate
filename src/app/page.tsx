import Link from "next/link";
import { MeditationCover } from "@/components/meditation-cover";
import { Nav } from "@/components/nav";
import { ScriptStreamDemo } from "@/components/script-stream-demo";
import { SiteFooter } from "@/components/site-footer";
import { metaLine } from "@/lib/meditation/meta";
import { Button } from "@/components/ui/button";
import { getQuotaConfig } from "@/lib/audio/quota";
import { countOf, freeTierSummary } from "@/lib/landing/copy";
import { DEMO_EXAMPLES } from "@/lib/landing/examples";
import { getLandingRow, type LandingRow } from "@/lib/landing/featured";
import { pageMetadata } from "@/lib/seo/metadata";
import { createClient } from "@/lib/supabase/server";

export const metadata = pageMetadata({
  title: "Zenerate — AI Meditation Generator",
  description:
    "Describe the meditation you need in your own words. Zenerate writes the script with AI, narrates it and sets its pauses and bells into one audio file.",
  path: "/",
});

// Written in the markup the model writes, so it renders through the real
// ScriptViewer. An example, and labelled as one on the page.
// The four things the app does, in the order a visitor does them. Each is
// checked against the code: the studio chat and its canvas
// (src/components/studio/), the voice and ambience pickers (ambience.ts), the
// sound effects (sounds.ts), drafts and archived versions (task 32), download,
// favourites, collections and the visibility toggle.
const steps = [
  {
    title: "Describe it",
    body: "Say in a sentence what it is for and how long. Writing starts straight away; if the request is too vague to write from, you get one short question first.",
  },
  {
    title: "Read the script",
    body: "It streams in beside the conversation as it is written, with pauses, silences and sounds marked between the passages. Change anything by asking, before it is narrated.",
  },
  {
    title: "Hear it",
    body: "Pick a narrator and a background: rain, ocean, forest, a soft drone, space, chanting, or none. In about a minute the passages are voiced, the bells and bowls are placed, and it all becomes one audio file.",
  },
  {
    title: "Keep it",
    body: "Listen here or download the file, then come back and ask for a change: keep the earlier version or replace it. Favourite it, file it into collections, or publish it on Discover.",
  },
];

export default async function LandingPage() {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    row,
  ] = await Promise.all([supabase.auth.getUser(), getLandingRow(supabase)]);

  // Read from the same config the quota check enforces, so the page cannot
  // drift from the cap when the environment changes it.
  const caps = { audio: getQuotaConfig().perUserCap };
  const composeHref = user ? "/create" : "/login";

  return (
    <div className="flex min-h-screen flex-col">
      <Nav isSignedIn={!!user} />

      <main className="flex-1">
        <section className="mx-auto grid max-w-5xl grid-cols-1 gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:items-start lg:gap-16 lg:py-14">
          <div className="space-y-6">
            <h1 className="font-serif text-[clamp(2rem,5vw,3rem)] leading-[1.15] font-medium tracking-[-0.01em] text-balance">
              Meditations composed for you, not picked from a catalogue.
            </h1>
            <p className="max-w-[56ch] text-lg text-pretty text-muted-foreground">
              Say what you want to sit with: a worry, a transition, a practice
              you are working on. Zenerate writes a meditation for it, narrates
              it in a voice you choose, and sets its pauses, silences and bells
              into one audio file you keep.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild size="lg">
                <Link href={composeHref}>Compose a meditation</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/discover">Listen to public ones</Link>
              </Button>
            </div>
            <p className="max-w-[56ch] text-sm text-muted-foreground">
              Free with an email account, up to{" "}
              {countOf(caps.audio, "narrated meditation")} a month.
            </p>
          </div>

          <ScriptStreamDemo examples={DEMO_EXAMPLES} />
        </section>

        <section className="border-t">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="font-serif text-2xl leading-tight font-medium">
              From one sentence to a session
            </h2>
            <ol className="mt-10 grid gap-x-12 gap-y-10 sm:grid-cols-2">
              {steps.map((step, i) => (
                <li key={step.title} className="space-y-2 border-t pt-6">
                  <p className="text-xs font-medium tracking-[0.06em] text-muted-foreground uppercase tabular-nums">
                    Step {i + 1}
                  </p>
                  <h3 className="font-serif text-xl font-medium">{step.title}</h3>
                  <p className="max-w-[52ch] text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
            {row ? (
              <HearOneFirst row={row} />
            ) : (
              <div className="max-w-3xl space-y-3">
                <h2 className="font-serif text-2xl leading-tight font-medium">
                  Hear one first
                </h2>
                <p className="max-w-[60ch] text-muted-foreground">
                  Meditations people choose to publish are on{" "}
                  <Link href="/discover" className="text-primary underline underline-offset-4">
                    Discover
                  </Link>
                  , open to anyone without an account.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="border-t">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="max-w-3xl space-y-4">
              <h2 className="font-serif text-2xl leading-tight font-medium">
                Free, at hobby scale
              </h2>
              <div className="max-w-[60ch] space-y-4 text-muted-foreground">
                <p>
                  Zenerate is one person&apos;s project, and there is no paid
                  plan. An account is free. {freeTierSummary(caps)} The count
                  resets on the first of each month (UTC), and a narration that
                  fails can be tried again once without using one up.
                </p>
                <p>
                  Scripts are written by AI and narrated by AI voices. The{" "}
                  <Link href="/terms" className="text-primary underline underline-offset-4">
                    Terms
                  </Link>{" "}
                  say what that means for you.
                </p>
              </div>
              {!user && (
                <div className="pt-4">
                  <Button asChild size="lg">
                    <Link href="/login">Create a free account</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

/**
 * Three meditations to listen to, each with its cover and tags: the house
 * picks, or the newest on Discover until there are three picks. A stacked list
 * on a phone, so nothing scrolls sideways; three columns from `sm`.
 */
function HearOneFirst({ row }: { row: LandingRow }) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="font-serif text-2xl leading-tight font-medium">Hear one first</h2>
        <p className="text-sm text-muted-foreground">
          {row.source === "featured" ? "Picked from Discover." : "The newest on Discover."}
        </p>
      </div>
      <ul className="grid max-w-3xl gap-4 sm:grid-cols-3 sm:gap-6">
        {row.meditations.map((m) => {
          const meta = metaLine({ tags: m.tags, settings: m.settings });
          return (
            <li key={m.id}>
              <Link
                href={`/meditation/${m.id}`}
                className="group flex items-center gap-4 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:flex-col sm:items-stretch sm:gap-3"
              >
                <MeditationCover id={m.id} tags={m.tags ?? []} title={m.title} size={72} className="sm:hidden" />
                {/* Drawn at the column's widest and scaled to fit it. */}
                <MeditationCover
                  id={m.id}
                  tags={m.tags ?? []}
                  title={m.title}
                  size={240}
                  className="hidden h-auto w-full sm:block"
                />
                <div className="min-w-0 space-y-1">
                  <p className="line-clamp-2 font-serif text-base leading-snug font-medium group-hover:text-accent-foreground">
                    {m.title}
                  </p>
                  {meta && <p className="truncate text-xs text-muted-foreground tabular-nums">{meta}</p>}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-muted-foreground">
        More on{" "}
        <Link href="/discover" className="text-primary underline underline-offset-4">
          Discover
        </Link>
        , open to anyone without an account.
      </p>
    </div>
  );
}
