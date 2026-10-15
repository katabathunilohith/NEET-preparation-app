import { CHAPTERS, chapterShare } from '../data/syllabus';
import type { AppState, Subject } from '../types';
import { mastery } from './mastery';

/**
 * Approximate NEET marks → All-India-Rank curve (out of 720), based on recent years' trends.
 * It is an estimate only; actual ranks vary every year.
 */
const CURVE: [marks: number, rank: number][] = [
  [720, 1], [700, 150], [680, 1500], [660, 4500], [640, 10000], [620, 18000], [600, 28000],
  [580, 40000], [550, 62000], [500, 110000], [450, 170000], [400, 250000], [350, 350000],
  [300, 480000], [200, 800000], [140, 1100000], [0, 2300000],
];

export function rankForMarks(marks: number): number {
  const m = Math.max(0, Math.min(720, marks));
  for (let i = 0; i < CURVE.length - 1; i++) {
    const [m1, r1] = CURVE[i];
    const [m2, r2] = CURVE[i + 1];
    if (m <= m1 && m >= m2) {
      const t = (m1 - m) / (m1 - m2);
      return Math.round(Math.exp(Math.log(r1) + t * (Math.log(r2) - Math.log(r1))));
    }
  }
  return CURVE[CURVE.length - 1][1];
}

export function marksForRank(rank: number): number {
  const r = Math.max(1, rank);
  for (let i = 0; i < CURVE.length - 1; i++) {
    const [m1, r1] = CURVE[i];
    const [m2, r2] = CURVE[i + 1];
    if (r >= r1 && r <= r2) {
      const t = (Math.log(r) - Math.log(r1)) / (Math.log(r2) - Math.log(r1));
      return Math.round(m1 - t * (m1 - m2));
    }
  }
  return 0;
}

/** Accuracy needed if every question is attempted: marks = 180·(5p − 1). */
export function accuracyForMarks(marks: number): number {
  return Math.min(0.995, Math.max(0.2, (marks / 180 + 1) / 5));
}

/** Expected marks from one question at success probability p, skipping when a guess is unprofitable. */
export function marksPerQuestion(p: number): number {
  return Math.max(0, 5 * p - 1);
}

export function predictedMarks(state: Pick<AppState, 'stats'>, now: number): number {
  let total = 0;
  for (const ch of CHAPTERS) {
    const p = mastery(state.stats[ch.id], now);
    total += chapterShare(ch) * 180 * marksPerQuestion(p);
  }
  return Math.round(Math.min(720, total));
}

export function subjectMastery(state: Pick<AppState, 'stats'>, now: number): Record<Subject, number> {
  const out = { Physics: 0, Chemistry: 0, Biology: 0 } as Record<Subject, number>;
  const tot = { Physics: 0, Chemistry: 0, Biology: 0 } as Record<Subject, number>;
  for (const ch of CHAPTERS) {
    out[ch.subject] += mastery(state.stats[ch.id], now) * ch.weight;
    tot[ch.subject] += ch.weight;
  }
  for (const s of Object.keys(out) as Subject[]) out[s] = out[s] / tot[s];
  return out;
}
