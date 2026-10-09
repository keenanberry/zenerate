import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Nav } from "@/components/nav";
import { ScriptStreamDemo } from "@/components/script-stream-demo";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { getScriptQuotaConfig } from "@/lib/ai/quota";
import { getQuotaConfig } from "@/lib/audio/quota";
import { countOf, firstPassage, freeTierSummary } from "@/lib/landing/copy";
import {
  getLatestPublicMeditation,
  type LatestMeditation,
} from "@/lib/landing/latest-meditation";
import { createClient } from "@/lib/supabase/server";

// Written in the markup the model writes, so it renders through the real
// ScriptViewer. An example, and labelled as one on the page.
const DEMO_FOCUS = "the night before a hard conversation";
const DEMO_SCRIPT = `*[SOUND: bell-tibetan.mp3]*

Settle into wherever you are sitting. There is nothing to prepare in this moment, and nothing yet to say.

*[PAUSE: 5 seconds]*

Notice the conversation you have been rehearsing. Let it move a little further away, the way a voice sounds from another room.

*[PAUSE: 8 seconds]*

Breathe in slowly. As you breathe out, let your jaw soften and your shoulders drop.

*[SILENCE: 1 minute]*`;

// The four things the app does, in the order a visitor does them. Each is
// checked against the code: the wizard's types, lengths and templates
// (meditation-form.tsx, templates.ts), the script editor, the voice picker,
// the sound effects (sounds.ts), download, favourites, collections and the
// visibility toggle.
const steps = [
  {
    title: "Describe it",
    body: "Choose a type and a length from 5 to 60 minutes, then say in your own words what it is for. Or begin from a template.",
  },
  {
    title: "Read the script",
    body: "It streams in as it is written, with pauses, silences and sounds marked between the passages. Change anything before it is narrated.",
  },
  {
    title: "Hear it",
    body: "Pick a narrator. In about a minute the passages are voiced, the bells, gongs and singing bowls are placed, and it all becomes one audio file.",
  },
  {
    title: "Keep it",
    body: "Listen here or download the file. Favourite it, file it into collections, or publish it for anyone to hear on Discover.",
  },
];

export default async function LandingPage() {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    latest,
  ] = await Promise.all([
    supabase.auth.getUser(),
    getLatestPublicMeditation(supabase),
  ]);

  // Read from the same config the quota checks enforce, so the page cannot
  // drift from the caps when the environment changes them.
  const caps = {
    audio: getQuotaConfig().perUserCap,
    script: getScriptQuotaConfig().perUserCap,
  };
  const composeHref = user ? "/create" : "/login";

  return (
    <div className="flex min-h-screen flex-col">
      <Nav isSignedIn={!!user} />

      <main className="flex-1">
        <section className="mx-auto grid max-w-5xl grid-cols-1 gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:items-center lg:gap-16">
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

          <ScriptStreamDemo focus={DEMO_FOCUS} script={DEMO_SCRIPT} />
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
            {latest ? (
              <LatestOnDiscover meditation={latest} />
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
                  plan. An account is free. {freeTierSummary(caps)} The counts
                  reset on the first of each month (UTC), and a narration that
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

function LatestOnDiscover({ meditation }: { meditation: LatestMeditation }) {
  const passage = firstPassage(meditation.script);
  const { type, duration } = meditation.settings ?? {};
  const meta = [
    duration ? `${duration} min` : null,
    type ? type.replace(/-/g, " ") : null,
  ].filter(Boolean);

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="font-serif text-2xl leading-tight font-medium">
        Hear one first
      </h2>
      <Link
        href={`/meditation/${meditation.id}`}
        className="group block space-y-4 rounded-xl border bg-card px-6 py-6 text-card-foreground outline-none hover:bg-card-hover focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-safe:transition-colors sm:px-8 sm:py-8"
      >
        <p className="text-xs font-medium tracking-[0.06em] text-muted-foreground uppercase">
          Newest on Discover
          {meta.length > 0 && <span className="normal-case tracking-normal"> · {meta.join(" · ")}</span>}
        </p>
        <h3 className="font-serif text-xl leading-snug font-medium text-balance">
          {meditation.title}
        </h3>
        {passage && (
          <p className="line-clamp-4 max-w-[60ch] font-serif text-lg leading-[1.9] text-foreground/80">
            {passage}
          </p>
        )}
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
          Open and listen
          <ArrowRight className="size-4 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden />
        </span>
      </Link>
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
