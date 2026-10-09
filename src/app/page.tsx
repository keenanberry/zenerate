import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Sparkles, Library, Compass, Volume2 } from "lucide-react";

const features = [
  {
    icon: Sparkles,
    title: "AI-Generated Scripts",
    description:
      "Describe the meditation you want and let AI craft a professional meditation script with pauses, sounds, and silences.",
  },
  {
    icon: Volume2,
    title: "Full Audio Experience",
    description:
      "Scripts are transformed into complete audio meditations with natural TTS, ambient music, and sound effects. (Coming soon)",
  },
  {
    icon: Library,
    title: "Personal Library",
    description:
      "Organize your meditations into collections, save favorites, and build your own meditation practice.",
  },
  {
    icon: Compass,
    title: "Discover Community",
    description:
      "Explore meditations shared by other creators. Find inspiration and save the ones that resonate with you.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <span className="text-lg font-bold tracking-tight">zenerate</span>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link href="/login">
              <Button size="sm">Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-3xl px-4 py-24 text-center">
          <h1 className="font-serif text-4xl font-bold tracking-tight sm:text-5xl">
            Meditation, <span className="text-primary">generated.</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Create personalized meditation experiences with AI. From guided
            relaxation to deep breathwork — describe it, generate it, listen to
            it.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link href="/login">
              <Button size="lg" className="gap-2">
                <Sparkles className="h-4 w-4" />
                Start Creating
              </Button>
            </Link>
            <Link href="/discover">
              <Button variant="outline" size="lg" className="gap-2">
                <Compass className="h-4 w-4" />
                Explore
              </Button>
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="border-t bg-muted/30 py-20">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-center font-serif text-2xl font-bold tracking-tight">
              Everything you need to build a meditation practice
            </h2>
            <div className="mt-12 grid gap-8 sm:grid-cols-2">
              {features.map((feature) => (
                <div key={feature.title} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{feature.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="mx-auto max-w-2xl px-4 text-center">
            <h2 className="font-serif text-2xl font-bold tracking-tight">
              Ready to find your calm?
            </h2>
            <p className="mt-2 text-muted-foreground">
              Create your first AI-generated meditation in under a minute.
            </p>
            <Link href="/login">
              <Button size="lg" className="mt-6">
                Get started for free
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
