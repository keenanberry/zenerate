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
  prompt: string;
  script: string | null;
  audio_url: string | null;
  status: MeditationStatus;
  is_public: boolean;
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

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CollectionWithCount extends Collection {
  item_count: number;
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
