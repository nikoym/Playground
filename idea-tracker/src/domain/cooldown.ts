import type { Idea, Settings } from "./types";
import { daysBetween } from "./time";

/** Days left until an inbox idea may be scored (0 = scorable now). */
export function daysUntilScorable(idea: Idea, settings: Settings, now: Date): number {
  if (idea.cooldownSkipped) return 0;
  const elapsed = daysBetween(idea.createdAt, now);
  return Math.max(0, Math.ceil(settings.cooldownDays - elapsed));
}

export function isScorable(idea: Idea, settings: Settings, now: Date): boolean {
  if (idea.status === "candidate") return true;
  if (idea.status !== "inbox") return false;
  return daysUntilScorable(idea, settings, now) === 0;
}
