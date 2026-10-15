import { CHAPTERS, CHAPTER_BY_ID, NEET_PATTERN, SUBJECTS } from '../data/syllabus';
import type { AppState, Difficulty, Question, Subject, SubjectScore, TestResult } from '../types';
import { questionsByChapter } from './bank';
import { BASE_Q_RATING, START_RATING, dominantMistake, effectiveRating } from './mastery';
import { KIND_FOR_MISTAKE, buildGenerated, generatorOf, generatorsFor, isGenerated, ratingKey, sibling } from './generators';
import type { StudyPath } from './path';
import { dueCards } from './srs';
import { rng, shuffle } from './random';

export interface TestSpec {
  kind: 'daily' | 'weekly' | 'custom';
  title: string;
  questionIds: string[];
  durationSec: number;
}

export { rng };

function weightedPick<T>(items: T[], weight: (t: T) => number, rand: () => number): T | undefined {
  const total = items.reduce((s, i) => s + Math.max(0, weight(i)), 0);
  if (total <= 0) return items[Math.floor(rand() * items.length)];
  let r = rand() * total;
  for (const i of items) {
    r -= Math.max(0, weight(i));
    if (r <= 0) return i;
  }
  return items[items.length - 1];
}

/**
 * Picks the best next question for a chapter. Candidates are her bank questions plus
 * freshly generated variants. Selection favours:
 *  - questions she hasn't seen (or not for a while),
 *  - difficulty near where she succeeds ~60% of the time ("desirable difficulty"),
 *  - generated questions of the kind that trains her dominant mistake type
 *    (numericals for calculation slips, fact recall for memory gaps, …),
 *  - generated questions once the fixed bank is mostly used up.
 */
export function pickQuestion(state: AppState, chapterId: string, exclude: Set<string>, now: number, rand: () => number, difficulty?: Difficulty): Question | undefined {
  const bank = (questionsByChapter(state)[chapterId] ?? []).filter((q) => !exclude.has(q.id) && (!difficulty || q.difficulty === difficulty));
  const gens = generatorsFor(chapterId).filter((g) => !difficulty || g.difficulty === difficulty);
  const excludedGen = new Set([...exclude].filter(isGenerated).map(ratingKey));
  const generated = gens
    .filter((g) => !excludedGen.has(`gen:${g.id}`))
    .map((g) => buildGenerated(g, Math.floor(rand() * 2 ** 31)));
  const pool = [...bank, ...generated];
  if (!pool.length) return undefined;

  const stat = state.stats[chapterId];
  const ability = stat ? effectiveRating(stat, now) : START_RATING;
  const ideal = ability - 70;
  const lastSeen: Record<string, number> = {};
  for (const a of state.attempts) if (a.chapterId === chapterId) lastSeen[a.qid] = a.at;
  const unseenBank = bank.filter((q) => lastSeen[q.id] === undefined).length;
  const flaw = dominantMistake(stat);
  const wantedKinds = flaw && stat && stat.mistakes[flaw] >= 2 ? KIND_FOR_MISTAKE[flaw] : [];

  return weightedPick(
    pool,
    (q) => {
      const r = state.qRatings[ratingKey(q.id)] ?? BASE_Q_RATING[q.difficulty];
      const fit = Math.exp(-(((r - ideal) / 220) ** 2));
      if (q.generated) {
        const g = generatorOf(q.id)!;
        let w = 0.15 + fit * 1.4;
        if (unseenBank < 2) w *= 2.5; // bank exhausted: lean on generators
        if (wantedKinds.includes(g.kind)) w *= 2.5; // train the specific flaw
        return w;
      }
      const seen = lastSeen[q.id];
      const freshness = seen === undefined ? 3 : Math.min(2, (now - seen) / (7 * 86_400_000));
      return 0.15 + fit * (0.5 + freshness);
    },
    rand,
  );
}

export function practiceSet(state: AppState, chapterId: string, n: number, now: number, seed = now): string[] {
  const rand = rng(seed);
  const chosen = new Set<string>();
  for (let i = 0; i < n; i++) {
    const q = pickQuestion(state, chapterId, chosen, now, rand);
    if (!q) break;
    chosen.add(q.id);
  }
  return [...chosen];
}

/** Daily adaptive test: 60% weak focus chapters, 20% due mistakes, 20% weightage-proportional coverage. */
export function dailyTest(state: AppState, path: StudyPath, now: number, size = 15): TestSpec {
  const rand = rng(now);
  const chosen = new Set<string>();
  const add = (q?: Question) => q && chosen.add(q.id);

  const existing = questionsByChapter(state);
  const exists = (qid: string, chapterId: string) => isGenerated(qid) ? !!generatorOf(qid) : (existing[chapterId] ?? []).some((q) => q.id === qid);
  for (const card of dueCards(state, now).filter((c) => exists(c.qid, c.chapterId)).slice(0, Math.round(size * 0.2))) {
    chosen.add(isGenerated(card.qid) ? sibling(card.qid, Math.floor(rand() * 2 ** 31))!.id : card.qid);
  }
  const top = path.chapters.filter((c) => c.stage !== 'polish').slice(0, 8);
  const weakTarget = chosen.size + Math.round(size * 0.6);
  for (let i = 0; chosen.size < weakTarget && i < size * 4; i++) {
    const ch = weightedPick(top.length ? top : path.chapters.slice(0, 8), (c) => c.priority, rand);
    if (ch) add(pickQuestion(state, ch.chapter.id, chosen, now, rand));
  }
  for (let i = 0; chosen.size < size && i < size * 4; i++) {
    const ch = weightedPick(CHAPTERS, (c) => c.weight, rand);
    if (ch) add(pickQuestion(state, ch.id, chosen, now, rand));
  }
  return { kind: 'daily', title: 'Daily adaptive test', questionIds: shuffle([...chosen], rand), durationSec: size * 60 };
}

/** Weekly test in NEET proportions (Physics : Chemistry : Biology = 1 : 1 : 2), chapters sampled by weightage. */
export function weeklyTest(state: AppState, now: number, size = 45): TestSpec {
  const rand = rng(now ^ 0x5bd1e995);
  const ids: string[] = [];
  for (const subject of SUBJECTS) {
    const n = Math.round((NEET_PATTERN[subject] / 180) * size);
    const chapters = CHAPTERS.filter((c) => c.subject === subject);
    const chosen = new Set<string>();
    for (let i = 0; chosen.size < n && i < n * 6; i++) {
      const ch = weightedPick(chapters, (c) => c.weight, rand)!;
      const q = pickQuestion(state, ch.id, chosen, now, rand);
      if (q) chosen.add(q.id);
    }
    ids.push(...chosen);
  }
  // NEET order: Physics, Chemistry, Biology — kept as-is.
  return { kind: 'weekly', title: 'Weekly NEET-pattern test', questionIds: ids, durationSec: Math.round(ids.length * (200 * 60) / 180) };
}

export function customTest(state: AppState, chapterIds: string[], size: number, difficulty: Difficulty | undefined, now: number): TestSpec {
  const rand = rng(now);
  const chosen = new Set<string>();
  for (let i = 0; chosen.size < size && i < size * 6; i++) {
    const id = chapterIds[Math.floor(rand() * chapterIds.length)];
    const q = pickQuestion(state, id, chosen, now, rand, difficulty);
    if (q) chosen.add(q.id);
  }
  return { kind: 'custom', title: 'Custom test', questionIds: shuffle([...chosen], rand), durationSec: chosen.size * 60 };
}

export const testId = (submittedAt: number) => `t${submittedAt.toString(36)}`;

/** NEET marking: +4 correct, −1 wrong, 0 unattempted. */
export function scoreTest(spec: TestSpec, qmap: Record<string, Question>, answers: (number | null)[], times: number[], startedAt: number, id: string): TestResult {
  const bySubject = Object.fromEntries(SUBJECTS.map((s) => [s, { correct: 0, wrong: 0, skipped: 0, score: 0, max: 0 }])) as Record<Subject, SubjectScore>;
  let correct = 0, wrong = 0, skipped = 0;
  spec.questionIds.forEach((qid, i) => {
    const q = qmap[qid];
    if (!q) return;
    const s = bySubject[CHAPTER_BY_ID[q.chapterId].subject];
    s.max += 4;
    const a = answers[i];
    if (a === null || a === undefined) {
      skipped++;
      s.skipped++;
    } else if (a === q.answer) {
      correct++;
      s.correct++;
      s.score += 4;
    } else {
      wrong++;
      s.wrong++;
      s.score -= 1;
    }
  });
  return {
    id,
    kind: spec.kind,
    startedAt,
    durationSec: times.reduce((a, b) => a + b, 0),
    questionIds: spec.questionIds,
    answers,
    times,
    score: correct * 4 - wrong,
    maxScore: spec.questionIds.length * 4,
    correct,
    wrong,
    skipped,
    bySubject,
  };
}
