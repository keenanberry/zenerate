export interface MeditationTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: string;
  duration: number;
  focus: string;
  preferences?: string;
}

export const meditationTemplates: MeditationTemplate[] = [
  {
    id: "morning-calm",
    name: "Morning Calm",
    description: "Start your day centered and grounded",
    icon: "Sunrise",
    type: "guided",
    duration: 10,
    focus: "morning energy and calm intention setting",
    preferences:
      "Gentle and uplifting tone, focus on breath awareness and setting a positive intention for the day",
  },
  {
    id: "sleep-wind-down",
    name: "Sleep Wind-Down",
    description: "Drift into restful, deep sleep",
    icon: "Moon",
    type: "sleep",
    duration: 20,
    focus: "releasing the day and preparing for deep sleep",
    preferences:
      "Very slow pacing, progressive body relaxation, soft and drowsy tone",
  },
  {
    id: "focus-session",
    name: "Focus Session",
    description: "Sharpen your concentration and clarity",
    icon: "Target",
    type: "mindfulness",
    duration: 10,
    focus: "mental clarity and focused attention",
    preferences:
      "Concentration-based technique, anchor attention on breath, minimal narration during practice period",
  },
  {
    id: "stress-relief",
    name: "Stress Relief",
    description: "Release tension and find your ease",
    icon: "Wind",
    type: "guided",
    duration: 15,
    focus: "stress release and deep relaxation",
    preferences:
      "Body scan elements, progressive muscle relaxation cues, soothing and reassuring tone",
  },
  {
    id: "gratitude-practice",
    name: "Gratitude Practice",
    description: "Cultivate appreciation and joy",
    icon: "Heart",
    type: "loving-kindness",
    duration: 10,
    focus: "gratitude and appreciating the present moment",
    preferences:
      "Guide through gratitude reflections, include loving-kindness phrases, warm and gentle tone",
  },
  {
    id: "body-scan-basics",
    name: "Body Scan",
    description: "Reconnect with your body head to toe",
    icon: "Activity",
    type: "body-scan",
    duration: 15,
    focus: "full body awareness and tension release",
    preferences:
      "Systematic head-to-toe body scan, pause at each body region, encourage noticing without judgment",
  },
  {
    id: "breathwork-basics",
    name: "Breathwork",
    description: "Energize or calm through breath patterns",
    icon: "Wind",
    type: "breathwork",
    duration: 10,
    focus: "deep breathing techniques for relaxation",
    preferences:
      "4-7-8 breathing pattern, box breathing, clear counting instructions with pauses",
  },
  {
    id: "visualization-journey",
    name: "Visualization",
    description: "Journey through peaceful inner landscapes",
    icon: "Mountain",
    type: "visualization",
    duration: 15,
    focus: "peaceful nature visualization for deep relaxation",
    preferences:
      "Vivid sensory imagery, guide through a serene natural landscape, engage all five senses",
  },
];
