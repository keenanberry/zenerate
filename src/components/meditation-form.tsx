"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCompletion } from "@ai-sdk/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScriptViewer } from "@/components/script-viewer";
import { createMeditation } from "@/lib/meditation/actions";
import { buildMeditationPrompt } from "@/lib/ai/prompts";
import { Loader2, Sparkles, Save } from "lucide-react";

const meditationTypes = [
  { value: "guided", label: "Guided Meditation" },
  { value: "body-scan", label: "Body Scan" },
  { value: "breathwork", label: "Breathwork" },
  { value: "loving-kindness", label: "Loving Kindness" },
  { value: "visualization", label: "Visualization" },
  { value: "mindfulness", label: "Mindfulness" },
  { value: "sleep", label: "Sleep Meditation" },
  { value: "manifestation", label: "Manifestation" },
  { value: "mantra", label: "Mantra" },
];

const durations = [
  { value: "5", label: "5 minutes" },
  { value: "10", label: "10 minutes" },
  { value: "15", label: "15 minutes" },
  { value: "20", label: "20 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "45", label: "45 minutes" },
  { value: "60", label: "60 minutes" },
];

export function MeditationForm() {
  const router = useRouter();
  const [type, setType] = useState("guided");
  const [duration, setDuration] = useState("10");
  const [focus, setFocus] = useState("");
  const [preferences, setPreferences] = useState("");
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  const { completion, isLoading, complete } = useCompletion({
    api: "/api/generate",
    streamProtocol: "text",
  });

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();

    const prompt = buildMeditationPrompt({
      type,
      duration: parseInt(duration),
      focus: focus || undefined,
      preferences: preferences || undefined,
    });

    const selectedType = meditationTypes.find((t) => t.value === type);
    if (!title) {
      setTitle(
        `${selectedType?.label ?? "Meditation"} — ${focus || "General"}`
      );
    }

    await complete(prompt);
  }

  async function handleSave() {
    if (!completion) return;
    setSaving(true);
    try {
      const finalTitle =
        title ||
        `${meditationTypes.find((t) => t.value === type)?.label ?? "Meditation"} — ${focus || "General"}`;

      const meditation = await createMeditation({
        title: finalTitle,
        prompt: buildMeditationPrompt({
          type,
          duration: parseInt(duration),
          focus: focus || undefined,
          preferences: preferences || undefined,
        }),
        script: completion,
        status: "script_ready",
        is_public: isPublic,
        settings: {
          type,
          duration: parseInt(duration),
          focus: focus || undefined,
        },
      });
      router.push(`/meditation/${meditation.id}`);
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Meditation Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {meditationTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Duration</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {durations.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="focus">Focus / Intention</Label>
              <Input
                id="focus"
                placeholder="e.g., stress relief, gratitude, morning energy..."
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferences">Additional Preferences</Label>
              <Textarea
                id="preferences"
                placeholder="Any specific requests, themes, or guidance style..."
                value={preferences}
                onChange={(e) => setPreferences(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title (optional)</Label>
              <Input
                id="title"
                placeholder="Auto-generated if left blank"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="public"
                checked={isPublic}
                onCheckedChange={setIsPublic}
              />
              <Label htmlFor="public" className="text-sm">
                Make this meditation public on Discover
              </Label>
            </div>

            <Button type="submit" disabled={isLoading} className="gap-2">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Script
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {(completion || isLoading) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Generated Script</CardTitle>
              {completion && !isLoading && (
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  size="sm"
                  className="gap-2"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Meditation
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {completion ? (
              <ScriptViewer script={completion} />
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating your meditation script...
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
