"use client";

import { useState, useCallback } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScriptViewer } from "@/components/script-viewer";
import { ScriptEditor } from "@/components/script-editor";
import { WizardSteps } from "@/components/wizard-steps";
import { createMeditation } from "@/lib/meditation/actions";
import { buildMeditationPrompt } from "@/lib/ai/prompts";
import {
  meditationTemplates,
  type MeditationTemplate,
} from "@/lib/meditation/templates";
import {
  Loader2,
  Sparkles,
  Save,
  ArrowLeft,
  ArrowRight,
  Pencil,
  RefreshCw,
  Sunrise,
  Moon,
  Target,
  Wind,
  Heart,
  Activity,
  Mountain,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap: Record<string, LucideIcon> = {
  Sunrise,
  Moon,
  Target,
  Wind,
  Heart,
  Activity,
  Mountain,
};

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
  { value: "5", label: "5 min" },
  { value: "10", label: "10 min" },
  { value: "15", label: "15 min" },
  { value: "20", label: "20 min" },
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "60 min" },
];

const STEPS = [
  { label: "Type" },
  { label: "Details" },
  { label: "Generate" },
  { label: "Save" },
];

export function MeditationForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [type, setType] = useState("guided");
  const [duration, setDuration] = useState("10");
  const [focus, setFocus] = useState("");
  const [preferences, setPreferences] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [editedScript, setEditedScript] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const { completion, isLoading, complete } = useCompletion({
    api: "/api/generate",
    streamProtocol: "text",
    onError: (error) => {
      setGenerateError(
        error.message ||
          "Something went wrong generating your script. Please try again.",
      );
    },
  });

  const currentScript = editedScript ?? completion;

  function applyTemplate(template: MeditationTemplate) {
    setSelectedTemplate(template.id);
    setType(template.type);
    setDuration(String(template.duration));
    setFocus(template.focus);
    if (template.preferences) setPreferences(template.preferences);
  }

  const generateTitle = useCallback(() => {
    const selectedType = meditationTypes.find((t) => t.value === type);
    return `${selectedType?.label ?? "Meditation"} — ${focus || "General"}`;
  }, [type, focus]);

  async function handleGenerate() {
    setGenerateError(null);
    setEditedScript(null);
    setIsEditing(false);
    const prompt = buildMeditationPrompt({
      type,
      duration: parseInt(duration),
      focus: focus || undefined,
      preferences: preferences || undefined,
    });
    if (!title) setTitle(generateTitle());
    await complete(prompt);
  }

  async function handleRegenerate() {
    setGenerateError(null);
    setEditedScript(null);
    setIsEditing(false);
    const prompt = buildMeditationPrompt({
      type,
      duration: parseInt(duration),
      focus: focus || undefined,
      preferences: preferences || undefined,
    });
    await complete(prompt);
  }

  async function handleSave() {
    if (!currentScript) return;
    setSaving(true);
    try {
      const finalTitle = title || generateTitle();
      const meditation = await createMeditation({
        title: finalTitle,
        prompt: buildMeditationPrompt({
          type,
          duration: parseInt(duration),
          focus: focus || undefined,
          preferences: preferences || undefined,
        }),
        script: currentScript,
        status: "script_ready",
        is_public: false,
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

  function handleStepClick(targetStep: number) {
    if (targetStep < step) setStep(targetStep);
  }

  const canAdvance = () => {
    switch (step) {
      case 0:
        return true;
      case 1:
        return true;
      case 2:
        return !!currentScript && !isLoading;
      default:
        return false;
    }
  };

  return (
    <div className="space-y-6">
      <WizardSteps
        steps={STEPS}
        currentStep={step}
        onStepClick={handleStepClick}
      />

      {/* Step 1: Type & Duration */}
      {step === 0 && (
        <div className="space-y-6">
          {/* Manual selectors */}
          <Card className="py-4">
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={type}
                    onValueChange={(v) => {
                      setType(v);
                      setSelectedTemplate(null);
                    }}
                  >
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
                  <Label>Duration</Label>
                  <Select
                    value={duration}
                    onValueChange={(v) => {
                      setDuration(v);
                      setSelectedTemplate(null);
                    }}
                  >
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
            </CardContent>
          </Card>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                or start from a template
              </span>
            </div>
          </div>

          {/* Template presets */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {meditationTemplates.map((template) => {
              const Icon = iconMap[template.icon] ?? Sparkles;
              const isSelected = selectedTemplate === template.id;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => applyTemplate(template)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-all hover:border-primary/50 hover:bg-accent/50",
                    isSelected &&
                      "border-primary bg-primary/5 ring-1 ring-primary/30"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full",
                      isSelected
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{template.name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {template.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 2: Intention & Preferences */}
      {step === 1 && (
        <Card>
          <CardContent className="space-y-5 pt-6">
            <div className="space-y-2">
              <Label htmlFor="focus">Focus / Intention</Label>
              <Input
                id="focus"
                placeholder="e.g., stress relief, gratitude, morning energy..."
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                What would you like this meditation to center around?
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferences">Additional Preferences</Label>
              <Textarea
                id="preferences"
                placeholder="Any specific requests, themes, or guidance style..."
                value={preferences}
                onChange={(e) => setPreferences(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Optional: describe the tone, techniques, or specific elements
                you want included.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Auto-generated if left blank"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Generate & Preview */}
      {step === 2 && (
        <div className="space-y-4">
          {generateError && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {generateError}
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {meditationTypes.find((t) => t.value === type)?.label}
              </Badge>
              <Badge variant="secondary">{duration} min</Badge>
              {focus && <Badge variant="outline">{focus}</Badge>}
            </div>
            <div className="flex gap-2">
              {currentScript && !isLoading && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={handleRegenerate}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Regenerate
                  </Button>
                  <Button
                    type="button"
                    variant={isEditing ? "secondary" : "outline"}
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      if (!isEditing && !editedScript) {
                        setEditedScript(completion);
                      }
                      setIsEditing(!isEditing);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {isEditing ? "Done Editing" : "Edit Script"}
                  </Button>
                </>
              )}
              {!currentScript && !isLoading && (
                <Button
                  type="button"
                  onClick={handleGenerate}
                  className="w-full gap-2 sm:w-auto"
                >
                  <Sparkles className="h-4 w-4" />
                  Generate Script
                </Button>
              )}
            </div>
          </div>

          {isLoading && !completion && (
            <Card>
              <CardContent className="flex items-center justify-center gap-3 py-16">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Generating your meditation script...
                </p>
              </CardContent>
            </Card>
          )}

          {(completion || isLoading) && (
            <>
              {isEditing && editedScript !== null ? (
                <ScriptEditor
                  script={editedScript}
                  onChange={setEditedScript}
                />
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <ScriptViewer script={currentScript || ""} />
                    {isLoading && completion && (
                      <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Still generating...
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 4: Save & Configure */}
      {step === 3 && (
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-5 pt-6">
              <div className="space-y-2">
                <Label htmlFor="final-title">Title</Label>
                <Input
                  id="final-title"
                  value={title || generateTitle()}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                You can share this meditation publicly after generating audio.
              </p>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                Summary
              </h3>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {meditationTypes.find((t) => t.value === type)?.label}
                </Badge>
                <Badge variant="secondary">{duration} min</Badge>
                {focus && <Badge variant="outline">{focus}</Badge>}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setStep(step - 1)}
          disabled={step === 0}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </Button>

        {step < 3 ? (
          <Button
            type="button"
            onClick={() => setStep(step + 1)}
            disabled={!canAdvance()}
            className="gap-2"
          >
            <span className="hidden sm:inline">Next</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || !currentScript}
            className="gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Meditation
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
