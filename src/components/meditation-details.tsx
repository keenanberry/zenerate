"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TagPill, TagPills } from "@/components/tag-pills";
import { updateMeditationDetails } from "@/lib/meditation/actions";
import { TAG_GROUPS, TAG_LABELS, isTag, type Tag, type TagGroup } from "@/lib/meditation/tags";

const MAX_TAGS = 5;

const GROUP_LABELS: Record<TagGroup, string> = {
  themes: "Themes",
  practices: "Practices",
  moments: "Moments",
};

interface MeditationDetailsProps {
  meditationId: string;
  title: string;
  description: string | null;
  tags: string[];
  /** Only the owner gets the edit control; everyone else sees the same text read-only. */
  editable: boolean;
}

/**
 * The title, description and tags at the top of a meditation's page. The
 * studio agent sets them; the owner corrects them here, and this hand-edit is
 * the only one that survives (the script itself changes through the chat).
 */
export function MeditationDetails({
  meditationId,
  title,
  description,
  tags,
  editable,
}: MeditationDetailsProps) {
  // What the page shows. Seeded from the server and replaced on a save, so a
  // save reads as done before the revalidated page arrives.
  const [saved, setSaved] = useState({ title, description, tags });
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <DetailsForm
        meditationId={meditationId}
        initial={saved}
        onDone={(next) => {
          if (next) setSaved(next);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <h1 className="font-serif text-2xl font-medium tracking-tight text-balance">
          {saved.title}
        </h1>
        {editable && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="-my-0.5 shrink-0 text-muted-foreground"
            onClick={() => setEditing(true)}
            aria-label="Edit title, description and tags"
          >
            <Pencil />
          </Button>
        )}
      </div>
      {saved.description && (
        <p className="max-w-[60ch] text-muted-foreground">{saved.description}</p>
      )}
      <TagPills tags={saved.tags} className="pt-1" />
    </div>
  );
}

type Details = { title: string; description: string | null; tags: string[] };

function DetailsForm({
  meditationId,
  initial,
  onDone,
}: {
  meditationId: string;
  initial: Details;
  onDone: (saved?: Details) => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description ?? "");
  // A slug that has left the vocabulary would fail validation; drop it here so
  // the save goes through, rather than trapping the owner.
  const [tags, setTags] = useState<Tag[]>(initial.tags.filter(isTag));
  const [isPending, startTransition] = useTransition();

  const trimmedTitle = title.trim();

  function save() {
    if (!trimmedTitle) return;
    const next = { title: trimmedTitle, description: description.trim() || null, tags };
    startTransition(async () => {
      try {
        await updateMeditationDetails(meditationId, next);
        onDone(next);
      } catch {
        toast.error("Couldn't save those details");
      }
    });
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      onKeyDown={(e) => {
        // The tag popover portals out of the form but React still bubbles its
        // keys here; its own Escape closes it, not the whole edit.
        if (e.key !== "Escape" || isPending) return;
        if (e.currentTarget.contains(e.target as Node)) onDone();
      }}
    >
      <Field label="Title" htmlFor="details-title">
        <Input
          id="details-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          autoFocus
          aria-invalid={!trimmedTitle}
          className="font-serif text-lg md:text-lg"
        />
      </Field>

      <Field label="Description" htmlFor="details-description">
        <Textarea
          id="details-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={300}
          rows={2}
          placeholder="One or two sentences on what this meditation is for."
          className="max-w-[60ch]"
        />
      </Field>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-xs font-medium tracking-[0.06em] text-muted-foreground">
          Tags <span className="tabular-nums">({tags.length}/{MAX_TAGS})</span>
        </legend>
        <div className="flex flex-wrap items-center gap-2">
          {tags.map((tag) => (
            <TagPill key={tag} tag={tag} className="gap-1 pr-1">
              <button
                type="button"
                onClick={() => setTags(tags.filter((t) => t !== tag))}
                aria-label={`Remove ${TAG_LABELS[tag]}`}
                className="-my-1 -mr-0.5 rounded-full p-1 outline-none hover:bg-background/40 focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <X className="size-3" />
              </button>
            </TagPill>
          ))}
          <AddTagPopover
            selected={tags}
            disabled={tags.length >= MAX_TAGS}
            onAdd={(tag) => setTags([...tags, tag])}
          />
        </div>
      </fieldset>

      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" size="sm" disabled={isPending || !trimmedTitle}>
          {isPending ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() => onDone()}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={htmlFor}
        className="block text-xs font-medium tracking-[0.06em] text-muted-foreground"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function AddTagPopover({
  selected,
  disabled,
  onAdd,
}: {
  selected: Tag[];
  disabled: boolean;
  onAdd: (tag: Tag) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={disabled}
          className="rounded-full"
        >
          <Plus />
          {disabled ? `${MAX_TAGS} tags max` : "Add tag"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-80 w-80 space-y-4 overflow-y-auto">
        {(Object.keys(TAG_GROUPS) as TagGroup[]).map((group) => {
          const remaining = TAG_GROUPS[group].filter((tag) => !selected.includes(tag));
          if (remaining.length === 0) return null;
          return (
            <div key={group} className="space-y-2">
              <p className="text-xs font-medium tracking-[0.06em] text-muted-foreground">
                {GROUP_LABELS[group]}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {remaining.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      onAdd(tag);
                      // Close at the cap; otherwise stay open for the next pick.
                      if (selected.length + 1 >= MAX_TAGS) setOpen(false);
                    }}
                    className="rounded-full border border-border px-2.5 py-1 text-xs leading-none font-medium tracking-[0.06em] outline-none hover:bg-card-hover focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-safe:transition-colors"
                  >
                    {TAG_LABELS[tag]}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
