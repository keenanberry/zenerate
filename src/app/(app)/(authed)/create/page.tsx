import { MeditationForm } from "@/components/meditation-form";

export const metadata = {
  title: "Create Meditation | Zenerate",
};

export default function CreatePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
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
