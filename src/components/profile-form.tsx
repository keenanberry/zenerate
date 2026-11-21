"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PROFILE_LIMITS, type Profile } from "@/lib/profile/profile";
import {
  changedFields,
  fieldErrors,
  saveProfile,
  toFormValues,
  type ProfileField,
  type ProfileFormValues,
} from "@/lib/profile/form";

/**
 * The owner's profile on /account: name, bio, avatar URL and the opt-in
 * public switch, saved together through PATCH /api/profile. Seeded from the
 * server; a save replaces the seed with what the API stored.
 */
export function ProfileForm({ profile, email }: { profile: Profile; email: string | null }) {
  const [saved, setSaved] = useState(() => toFormValues(profile));
  const [values, setValues] = useState(saved);
  const [errors, setErrors] = useState<Partial<Record<ProfileField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const body = changedFields(saved, values);

  function set<K extends ProfileField>(field: K, value: ProfileFormValues[K]) {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
    setFormError(null);
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!body) return;
    const found = fieldErrors(body);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    startTransition(async () => {
      const result = await saveProfile(body);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      const next = toFormValues(result.profile);
      setSaved(next);
      setValues(next);
      toast.success("Profile saved");
      // The (app) layout reads the display name for the avatar's initials.
      router.refresh();
    });
  }

  const name = saved.display_name || email || "";
  const bioLength = [...values.bio.trim()].length;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar className="size-16 border">
          {saved.avatar_url && <AvatarImage src={saved.avatar_url} alt="" />}
          <AvatarFallback className="font-serif text-xl">
            {name.slice(0, 1).toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-medium">{saved.display_name || "No name yet"}</p>
          {email && <p className="truncate text-sm text-muted-foreground">{email}</p>}
        </div>
      </div>

      <Field id="display_name" label="Display name" error={errors.display_name}>
        <Input
          id="display_name"
          value={values.display_name}
          onChange={(e) => set("display_name", e.target.value)}
          autoComplete="nickname"
          aria-invalid={!!errors.display_name}
          aria-describedby={errors.display_name ? "display_name-error" : undefined}
        />
      </Field>

      <Field
        id="bio"
        label="Bio"
        error={errors.bio}
        hint={`${bioLength} / ${PROFILE_LIMITS.bio}`}
      >
        <Textarea
          id="bio"
          value={values.bio}
          onChange={(e) => set("bio", e.target.value)}
          placeholder="A line about who you are and what you make."
          rows={3}
          aria-invalid={!!errors.bio}
          aria-describedby={errors.bio ? "bio-error" : "bio-hint"}
        />
      </Field>

      <Field
        id="avatar_url"
        label="Avatar URL"
        error={errors.avatar_url}
        hint="An https:// link to an image."
      >
        <Input
          id="avatar_url"
          type="url"
          inputMode="url"
          value={values.avatar_url}
          onChange={(e) => set("avatar_url", e.target.value)}
          placeholder="https://"
          aria-invalid={!!errors.avatar_url}
          aria-describedby={errors.avatar_url ? "avatar_url-error" : "avatar_url-hint"}
        />
      </Field>

      <div className="flex items-start justify-between gap-6 border-t pt-6">
        <div className="space-y-1.5">
          <Label htmlFor="is_public">Public profile</Label>
          <p id="is_public-hint" className="max-w-[60ch] text-sm text-muted-foreground">
            Show your name, avatar and bio beside the meditations you make public. Off
            until you turn it on.
          </p>
        </div>
        <Switch
          id="is_public"
          checked={values.is_public}
          onCheckedChange={(checked) => set("is_public", checked)}
          aria-describedby="is_public-hint"
          className="mt-0.5"
        />
      </div>

      {formError && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {body && (
          <Button
            type="button"
            variant="ghost"
            disabled={isPending}
            onClick={() => {
              setValues(saved);
              setErrors({});
              setFormError(null);
            }}
          >
            Discard
          </Button>
        )}
        <Button type="submit" disabled={!body || isPending}>
          {isPending ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground tabular-nums">
          {hint}
        </p>
      )}
    </div>
  );
}
