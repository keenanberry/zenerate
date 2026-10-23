import type { UIMessage } from "ai";

export type MeditationStatus =
  | "generating_script"
  | "script_ready"
  | "processing_audio"
  | "completed"
  | "failed";

export interface GenerationMeta {
  tts_characters?: number;
  tts_requests?: number;
  processing_time_ms?: number;
  generated_at?: string;
}

export interface Meditation {
  id: string;
  user_id: string;
  title: string;
  /** The wizard's one-line request. Null for meditations made in the studio. */
  prompt: string | null;
  /** One or two sentences, set by the studio agent and editable by the owner. */
  description: string | null;
  /** Tags from the fixed vocabulary in tags.ts. */
  tags: string[];
  /**
   * The current version's script. A revision made after the audio lives in
   * the owner-only meditation_drafts table until a render promotes it here.
   */
  script: string | null;
  /** Short-lived signed URL, minted server-side at read time. Never persisted. */
  audio_url: string | null;
  /** Storage path within the meditation-audio bucket. This is what the DB holds. */
  audio_path?: string | null;
  status: MeditationStatus;
  is_public: boolean;
  /** House pick, set by the operator in SQL. */
  is_featured: boolean;
  settings: MeditationSettings;
  generation_meta: GenerationMeta | null;
  created_at: string;
  updated_at: string;
}

export interface MeditationSettings {
  type?: string;
  duration?: number;
  focus?: string;
  voice?: string;
  music?: string;
  volume?: number;
}

/** An archived version. The current version is the meditations row itself. */
export interface MeditationVersion {
  id: string;
  meditation_id: string;
  script: string;
  /** Storage path in meditation-audio. Delete the object with the row; storage does not cascade. */
  audio_path: string | null;
  voice: string | null;
  generation_meta: GenerationMeta | null;
  created_at: string;
}

/** One chat per meditation. A null meditation_id is a draft with no script yet. */
export interface Chat {
  id: string;
  user_id: string;
  meditation_id: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
}

/** A chat_messages row: one AI SDK UIMessage, with the id the server generated. */
export interface ChatMessageRow {
  id: string;
  chat_id: string;
  role: UIMessage["role"];
  parts: UIMessage["parts"];
  metadata: unknown;
  created_at: string;
}

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/** Enough of a meditation to draw its cover. */
export interface CollectionCover {
  id: string;
  title: string;
  tags: string[] | null;
}

export interface CollectionWithCount extends Collection {
  item_count: number;
  /** The first four items' covers, in order, for the collection's artwork. */
  covers?: CollectionCover[];
}

export interface CollectionItem {
  id: string;
  collection_id: string;
  meditation_id: string;
  position: number;
  added_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  meditation_id: string;
  created_at: string;
}

export type MeditationSegment =
  | { type: "speech"; content: string }
  | { type: "pause"; duration: number }
  | { type: "silence"; duration: number }
  | { type: "sound"; file: string };

export interface MeditationWithMeta extends Meditation {
  is_favorited?: boolean;
  user_email?: string;
}
