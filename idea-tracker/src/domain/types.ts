export type Category = "app-business" | "ai-video" | "game" | "other";
export type Status = "inbox" | "candidate" | "active" | "shipped" | "killed" | "archived";
export type Slot = "main" | "fun";

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: "app-business", label: "App / Business" },
  { value: "ai-video", label: "AI Video" },
  { value: "game", label: "Game" },
  { value: "other", label: "Other" },
];

export const SLOTS: { value: Slot; label: string; hint: string }[] = [
  { value: "main", label: "Main", hint: "Money & audience" },
  { value: "fun", label: "Fun", hint: "Passion" },
];

export interface Scores {
  money: number;
  passion: number;
  audience: number;
  effort: number; // 5 = huge effort (counts against)
  confidence: number;
}
export type Criterion = keyof Scores;

export const CRITERIA: { key: Criterion; label: string; question: string }[] = [
  { key: "money", label: "Money", question: "Could this make money within 6 months of shipping?" },
  { key: "passion", label: "Passion", question: "Would I build this even if it never paid?" },
  { key: "audience", label: "Audience", question: "Can I show it, post about it, grow a following with it?" },
  { key: "effort", label: "Effort", question: "How big is a first shippable version? (1 = a weekend, 5 = months)" },
  { key: "confidence", label: "Confidence", question: "Is there evidence anyone wants it?" },
];

export interface Milestone {
  id: string;
  title: string;
  done: boolean;
  doneAt?: string;
}

export interface CheckIn {
  id: string;
  date: string;
  progress: string;
  next: string;
  mood?: 1 | 2 | 3 | 4 | 5;
}

export interface PostMortem {
  whatWorked: string;
  whatDidnt: string;
  learned: string;
  reason?: string;
}

export interface Idea {
  id: string;
  title: string;
  note?: string;
  category: Category;
  status: Status;
  createdAt: string;
  updatedAt: string;
  scores?: Scores;
  scoredAt?: string;
  aiReview?: string;
  cooldownSkipped?: boolean;
  slot?: Slot;
  startedAt?: string;
  finishLine?: string;
  dueDate?: string;
  milestones?: Milestone[];
  checkIns?: CheckIn[];
  endedAt?: string;
  postMortem?: PostMortem;
  shipUrl?: string;
}

export interface Settings {
  cooldownDays: number;
  weights: Record<Criterion, number>;
  updatedAt: string;
}

export interface DataFile {
  version: 1;
  settings: Settings;
  ideas: Idea[];
  deletedIds: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  cooldownDays: 7,
  weights: { money: 1, passion: 1, audience: 1, effort: 1, confidence: 1 },
  updatedAt: new Date(0).toISOString(),
};

export function emptyDataFile(): DataFile {
  return { version: 1, settings: { ...DEFAULT_SETTINGS, weights: { ...DEFAULT_SETTINGS.weights } }, ideas: [], deletedIds: [] };
}

export const CHECKIN_INTERVAL_DAYS = 7;
export const MAX_DUE_WEEKS = 8;
export const DEFAULT_DUE_WEEKS = 6;
