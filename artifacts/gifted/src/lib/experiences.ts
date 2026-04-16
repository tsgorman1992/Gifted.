export type ExperienceId =
  | "confetti-burst"
  | "golden-hour"
  | "garden-bloom"
  | "midnight-stars"
  | "rose-petal"
  | "snow-flurry"
  | "sunrise"
  | "mothers-day"
  | "fathers-day"
  | "smoke-amber"
  | "carbon-steel"
  | "electric-night";

export const DEFAULT_EXPERIENCE: ExperienceId = "confetti-burst";

export interface ExperiencePalette {
  from: string;
  via: string;
  to: string;
}

export interface ExperienceMeta {
  id: ExperienceId;
  name: string;
  tagline: string;
  suggestedFor: string[];
  palette: ExperiencePalette;
  isDark: boolean;
  premium: boolean;
}

export const EXPERIENCE_LIST: ExperienceMeta[] = [
  {
    id: "confetti-burst",
    name: "Confetti Burst",
    tagline: "Bright & celebratory",
    suggestedFor: ["Birthday"],
    palette: { from: "#FF6B6B", via: "#FFD93D", to: "#6BCB77" },
    isDark: false,
    premium: false,
  },
  {
    id: "golden-hour",
    name: "Golden Hour",
    tagline: "Warm & romantic",
    suggestedFor: ["Anniversary"],
    palette: { from: "#F7C59F", via: "#E8A87C", to: "#D4813A" },
    isDark: false,
    premium: false,
  },
  {
    id: "garden-bloom",
    name: "Garden Bloom",
    tagline: "Soft & new beginnings",
    suggestedFor: ["New Baby"],
    palette: { from: "#FFB7C5", via: "#C7CEEA", to: "#B5EAD7" },
    isDark: false,
    premium: false,
  },
  {
    id: "midnight-stars",
    name: "Midnight Stars",
    tagline: "Bold & elevated",
    suggestedFor: ["Graduation"],
    palette: { from: "#0f0c29", via: "#302b63", to: "#24243e" },
    isDark: true,
    premium: false,
  },
  {
    id: "rose-petal",
    name: "Rose Petal",
    tagline: "Elegant & timeless",
    suggestedFor: ["Wedding", "Love"],
    palette: { from: "#FFB7C5", via: "#FF8FAB", to: "#E8A7B1" },
    isDark: false,
    premium: false,
  },
  {
    id: "snow-flurry",
    name: "Snow Flurry",
    tagline: "Crisp & festive",
    suggestedFor: ["Holiday"],
    palette: { from: "#BDE0FE", via: "#A2D2FF", to: "#CDB4DB" },
    isDark: false,
    premium: false,
  },
  {
    id: "sunrise",
    name: "Sunrise",
    tagline: "Warm & heartfelt",
    suggestedFor: ["Just Because", "Thank You", "Congratulations"],
    palette: { from: "#FFCBA4", via: "#FF9A8B", to: "#FF6A88" },
    isDark: false,
    premium: false,
  },
  {
    id: "mothers-day",
    name: "For Mom",
    tagline: "Tender & blooming",
    suggestedFor: ["Mother's Day"],
    palette: { from: "#C8A8E9", via: "#FFB7C5", to: "#FFCBA4" },
    isDark: false,
    premium: false,
  },
  {
    id: "fathers-day",
    name: "For Dad",
    tagline: "Steady & celebrated",
    suggestedFor: ["Father's Day"],
    palette: { from: "#1A2E4A", via: "#3A6B9E", to: "#C9A84C" },
    isDark: true,
    premium: false,
  },
  {
    id: "smoke-amber",
    name: "Smoke & Amber",
    tagline: "Dark & premium",
    suggestedFor: ["Birthday", "Congratulations", "Just Because"],
    palette: { from: "#1a1008", via: "#2d1f0a", to: "#4a2e0c" },
    isDark: true,
    premium: false,
  },
  {
    id: "carbon-steel",
    name: "Carbon & Steel",
    tagline: "Sharp & powerful",
    suggestedFor: ["Graduation", "Congratulations", "Just Because"],
    palette: { from: "#0d0d0d", via: "#1a1f2e", to: "#0f1929" },
    isDark: true,
    premium: false,
  },
  {
    id: "electric-night",
    name: "Electric Night",
    tagline: "Bold & electric",
    suggestedFor: ["Birthday", "Congratulations", "Just Because"],
    palette: { from: "#0a0015", via: "#110022", to: "#0d001a" },
    isDark: true,
    premium: false,
  },
];

export const EXPERIENCE_MAP: Record<ExperienceId, ExperienceMeta> =
  Object.fromEntries(EXPERIENCE_LIST.map((e) => [e.id, e])) as Record<ExperienceId, ExperienceMeta>;

export function getExperiencePalette(id: string): ExperiencePalette {
  return (EXPERIENCE_MAP[id as ExperienceId] ?? EXPERIENCE_MAP[DEFAULT_EXPERIENCE]).palette;
}

export function gradientStyle(id: string): React.CSSProperties {
  const p = getExperiencePalette(id);
  return { background: `linear-gradient(135deg, ${p.from}, ${p.via}, ${p.to})` };
}

export function getSuggestedExperience(occasion: string): ExperienceId {
  return EXPERIENCE_LIST.find((e) => e.suggestedFor.includes(occasion))?.id ?? DEFAULT_EXPERIENCE;
}
