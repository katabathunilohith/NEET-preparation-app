import { CHAPTER_BY_ID } from '../data/syllabus';
import type { Difficulty, MistakeType, Question, Subject, TopicStat } from '../types';

export const DAY = 86_400_000;
export const START_RATING = 1350;
/** Rating of a typical NEET-level question; mastery = chance of solving one. */
export const NEET_LEVEL = 1500;
export const BASE_Q_RATING: Record<Difficulty, number> = { easy: 1250, medium: 1450, hard: 1650 };

export const EXPECTED_SEC: Record<Subject, Record<Difficulty, number>> = {
  Physics: { easy: 45, medium: 75, hard: 110 },
  Chemistry: { easy: 35, medium: 60, hard: 90 },
  Biology: { easy: 25, medium: 40, hard: 60 },
};

export const MISTAKE_TYPES: MistakeType[] = ['concept', 'memory', 'calculation', 'misread', 'guess', 'time'];

export const MISTAKE_LABEL: Record<MistakeType, string> = {
  concept: 'Concept gap',
  memory: 'Forgot fact',
  calculation: 'Calculation slip',
  misread: 'Misread question',
  guess: 'Guessed',
  time: 'Too slow',
};

export function emptyMistakes(): Record<MistakeType, number> {
  return { concept: 0, memory: 0, calculation: 0, misread: 0, guess: 0, time: 0 };
}

export function newStat(chapterId: string): TopicStat {
  return {
    chapterId,
    rating: START_RATING,
    attempts: 0,
    correct: 0,
    lastAt: 0,
    stability: 3,
    mistakes: emptyMistakes(),
    recent: [],
    avgTimeRatio: 1,
  };
}

export function expectedScore(studentRating: number, questionRating: number): number {
  return 1 / (1 + 10 ** ((questionRating - studentRating) / 400));
}

export function expectedSeconds(q: Question): number {
  const subject = CHAPTER_BY_ID[q.chapterId]?.subject ?? 'Biology';
  return EXPECTED_SEC[subject][q.difficulty];
}

/** Rating after accounting for forgetting since the last practice (decays half-way toward the start rating). */
export function effectiveRating(stat: TopicStat, now: number): number {
  if (!stat.lastAt) return stat.rating;
  const days = Math.max(0, (now - stat.lastAt) / DAY);
  const retention = Math.exp(-days / Math.max(1, stat.stability));
  const forgotten = (stat.rating - START_RATING) * 0.5 * (1 - retention);
  return stat.rating - Math.max(0, forgotten);
}

/** Probability (0–1) of solving a typical NEET-level question from this chapter today. */
export function mastery(stat: TopicStat | undefined, now: number): number {
  if (!stat) return expectedScore(START_RATING, NEET_LEVEL);
  return expectedScore(effectiveRating(stat, now), NEET_LEVEL);
}

/** 0–1: how much evidence backs the mastery estimate. */
export function confidence(stat: TopicStat | undefined): number {
  const n = stat?.attempts ?? 0;
  return n / (n + 6);
}

export type Level = 'new' | 'weak' | 'developing' | 'strong';
export function levelOf(stat: TopicStat | undefined, now: number): Level {
  if (!stat || stat.attempts < 3) return 'new';
  const m = mastery(stat, now);
  if (m < 0.5) return 'weak';
  if (m < 0.78) return 'developing';
  return 'strong';
}

/** Recent trend: positive = improving. Compares newer half of recent results with the older half. */
export function trend(stat: TopicStat | undefined): number {
  const r = stat?.recent ?? [];
  if (r.length < 6) return 0;
  const half = Math.floor(r.length / 2);
  const avg = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
  return avg(r.slice(half)) - avg(r.slice(0, half));
}

export function dominantMistake(stat: TopicStat | undefined): MistakeType | null {
  if (!stat) return null;
  let best: MistakeType | null = null;
  let bestN = 0;
  for (const t of MISTAKE_TYPES) {
    if (stat.mistakes[t] > bestN) {
      best = t;
      bestN = stat.mistakes[t];
    }
  }
  return best;
}

/** First guess at why an answer was wrong, from timing and question style. The student can correct it. */
export function guessMistakeType(q: Question, timeSec: number): MistakeType {
  const ratio = timeSec / expectedSeconds(q);
  if (ratio < 0.3) return 'misread';
  if (ratio > 2.2) return 'time';
  const subject = CHAPTER_BY_ID[q.chapterId]?.subject;
  const numeric = /\d/.test(q.text) && /[=×÷/]|\bis\b/.test(q.text) && subject !== 'Biology';
  if (numeric && q.difficulty !== 'easy') return 'calculation';
  if (subject === 'Biology') return 'memory';
  return 'concept';
}

/**
 * Elo update for one answer. `result` is 1 (correct), 0 (wrong) or null (skipped, a mild negative).
 * Returns the new student rating and the new learned question rating.
 */
export function eloUpdate(
  studentRating: number,
  questionRating: number,
  attempts: number,
  result: 0 | 1 | null,
): { student: number; question: number } {
  const exp = expectedScore(studentRating, questionRating);
  const score = result === null ? 0.25 : result;
  const k = (24 + 40 / (1 + attempts / 8)) * (result === null ? 0.5 : 1);
  const delta = k * (score - exp);
  return { student: studentRating + delta, question: questionRating - delta * 0.15 };
}

/** Applies one answer to a chapter's statistics. */
export function updateStat(
  prev: TopicStat,
  questionRating: number,
  result: 0 | 1 | null,
  timeRatio: number,
  mistake: MistakeType | undefined,
  now: number,
): { stat: TopicStat; questionRating: number } {
  const base = effectiveRating(prev, now);
  const { student, question } = eloUpdate(base, questionRating, prev.attempts, result);
  const gapDays = prev.lastAt ? (now - prev.lastAt) / DAY : 0;
  let stability = prev.stability;
  if (result === 1 && gapDays >= 0.8) stability = Math.min(120, stability * (1.3 + Math.min(gapDays / stability, 1) * 0.5));
  if (result !== 1) stability = Math.max(2, stability * 0.8);
  const mistakes = { ...prev.mistakes };
  if (result !== 1 && mistake) mistakes[mistake] += 1;
  return {
    stat: {
      ...prev,
      rating: student,
      attempts: prev.attempts + 1,
      correct: prev.correct + (result === 1 ? 1 : 0),
      lastAt: now,
      stability,
      mistakes,
      recent: [...prev.recent, result === 1 ? 1 : 0].slice(-12),
      avgTimeRatio: prev.attempts === 0 ? timeRatio : prev.avgTimeRatio * 0.85 + timeRatio * 0.15,
    },
    questionRating: question,
  };
}
