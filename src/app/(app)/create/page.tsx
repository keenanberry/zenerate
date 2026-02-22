import { MeditationForm } from "@/components/meditation-form";

export const metadata = {
  title: "Create Meditation | Zenerate",
};

export default function CreatePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create Meditation</h1>
        <p className="text-muted-foreground">
          Describe the meditation you want and let AI generate the script.
        </p>
      </div>
      <MeditationForm />
    </div>
  );
}
