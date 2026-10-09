import { MeditationForm } from "@/components/meditation-form";

export const metadata = {
  title: "Create Meditation | Zenerate",
};

export default function CreatePage() {
  return (
    // A form, so a narrow column; wide enough for the script preview's 65ch
    // measure inside a card on the Generate step.
    <div className="mx-auto max-w-2xl space-y-10">
      <div className="space-y-2">
        <h1 className="font-serif text-2xl font-medium tracking-tight">
          Create Meditation
        </h1>
        <p className="text-muted-foreground">
          Choose a template or customize your own, then generate with AI.
        </p>
      </div>
      <MeditationForm />
    </div>
  );
}
