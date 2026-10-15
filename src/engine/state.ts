import { CHAPTER_BY_ID } from '../data/syllabus';
import type { AppState, Attempt, MistakeType, Mode, Question, TestResult } from '../types';
import { questionMap } from './bank';
import { isGenerated, ratingKey } from './generators';
import { BASE_Q_RATING, DAY, expectedSeconds, guessMistakeType, newStat, updateStat } from './mastery';
import { buildPath, dateKey, diffPath } from './path';
import { addMistake, reviewMistake } from './srs';
import { scoreTest, testId, type TestSpec } from './testgen';

export const STATE_VERSION = 1;
const MAX_ATTEMPTS = 20_000;

/** NEET-UG is usually held on the first Sunday of May. */
export function nextNeetDate(now: number): string {
  const today = new Date(now);
  for (let y = today.getFullYear(); ; y++) {
    const d = new Date(y, 4, 1);
    while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
    if (d.getTime() > now + 14 * DAY) return dateKey(d.getTime());
  }
}

export function defaultState(now: number): AppState {
  return {
    version: STATE_VERSION,
    updatedAt: 0,
    profile: { name: '', examDate: nextNeetDate(now), targetRank: 5000, dailyGoal: 30, onboarded: false, createdAt: now },
    stats: {},
    attempts: [],
    tests: [],
    mistakes: {},
    customQuestions: [],
    qRatings: {},
    pathHistory: [],
    tasksDone: {},
    bookmarks: [],
    theme: 'system',
  };
}

/** Accepts stored / imported data and fills any missing fields so old backups keep working. */
export function migrate(raw: unknown, now: number): AppState {
  const base = defaultState(now);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<AppState>;
  return {
    ...base,
    ...r,
    profile: { ...base.profile, ...(r.profile ?? {}) },
    stats: r.stats ?? {},
    attempts: Array.isArray(r.attempts) ? r.attempts : [],
    tests: Array.isArray(r.tests) ? r.tests : [],
    mistakes: r.mistakes ?? {},
    customQuestions: Array.isArray(r.customQuestions) ? r.customQuestions : [],
    qRatings: r.qRatings ?? {},
    pathHistory: Array.isArray(r.pathHistory) ? r.pathHistory : [],
    tasksDone: r.tasksDone ?? {},
    bookmarks: Array.isArray(r.bookmarks) ? r.bookmarks : [],
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : 0,
    version: STATE_VERSION,
  };
}

/** Records one answer: updates the chapter's ability, learned question difficulty and the mistake notebook. */
export function recordAnswer(
  state: AppState,
  q: Question,
  chosen: number | null,
  timeSec: number,
  mode: Mode,
  now: number,
  mistake?: MistakeType,
): AppState {
  const result: 0 | 1 | null = chosen === null ? null : chosen === q.answer ? 1 : 0;
  const type = result === 0 ? (mistake ?? guessMistakeType(q, timeSec)) : undefined;
  const prev = state.stats[q.chapterId] ?? newStat(q.chapterId);
  const qRating = state.qRatings[ratingKey(q.id)] ?? BASE_Q_RATING[q.difficulty];
  const timeRatio = timeSec / expectedSeconds(q);
  const { stat, questionRating } = updateStat(prev, qRating, result, timeRatio, type, now);
  const attempt: Attempt = { qid: q.id, chapterId: q.chapterId, correct: result === null ? null : result === 1, timeSec: Math.round(timeSec), at: now, mode, mistake: type };
  let mistakes = state.mistakes;
  if (mode === 'review') mistakes = reviewMistake(mistakes, q.id, result === 1, now);
  else if (isGenerated(q.id) && result !== null) {
    // A fresh variant of a generator she got wrong earlier counts as reviewing that mistake.
    const key = ratingKey(q.id);
    const card = Object.values(mistakes).find((c) => c.qid !== q.id && ratingKey(c.qid) === key && c.due <= now);
    if (card) mistakes = reviewMistake(mistakes, card.qid, result === 1, now);
    if (result === 0) mistakes = addMistake(mistakes, q.id, q.chapterId, type, now);
  }
  else if (result === 0) mistakes = addMistake(mistakes, q.id, q.chapterId, type, now);
  const attempts = [...state.attempts, attempt];
  return {
    ...state,
    stats: { ...state.stats, [q.chapterId]: stat },
    qRatings: { ...state.qRatings, [ratingKey(q.id)]: questionRating },
    attempts: attempts.length > MAX_ATTEMPTS ? attempts.slice(-MAX_ATTEMPTS) : attempts,
    mistakes,
  };
}

/** Lets the student correct the auto-detected reason for a mistake; the engine re-learns from it. */
export function setAttemptMistake(state: AppState, qid: string, at: number, type: MistakeType): AppState {
  const idx = state.attempts.findIndex((a) => a.qid === qid && a.at === at && a.correct === false);
  if (idx < 0) return state;
  const attempt = state.attempts[idx];
  const old = attempt.mistake;
  if (old === type) return state;
  const stat = state.stats[attempt.chapterId];
  const mistakes = stat ? { ...stat.mistakes } : null;
  if (mistakes) {
    if (old) mistakes[old] = Math.max(0, mistakes[old] - 1);
    mistakes[type] += 1;
  }
  const attempts = [...state.attempts];
  attempts[idx] = { ...attempt, mistake: type };
  const card = state.mistakes[qid];
  return {
    ...state,
    attempts,
    stats: stat && mistakes ? { ...state.stats, [attempt.chapterId]: { ...stat, mistakes } } : state.stats,
    mistakes: card ? { ...state.mistakes, [qid]: { ...card, lastType: type } } : state.mistakes,
  };
}

export function submitTest(
  state: AppState,
  spec: TestSpec,
  answers: (number | null)[],
  times: number[],
  startedAt: number,
  now: number,
): { state: AppState; result: TestResult } {
  const qmap = questionMap(state);
  let next = state;
  spec.questionIds.forEach((qid, i) => {
    const q = qmap[qid];
    if (!q) return;
    const mode: Mode = spec.kind;
    next = recordAnswer(next, q, answers[i] ?? null, times[i] ?? 0, mode, now);
  });
  const result = scoreTest(spec, qmap, answers, times, startedAt, testId(now));
  next = { ...next, tests: [...next.tests, result] };
  return { state: snapshotPath(next, now), result };
}

/** Recomputes the path and logs what changed, so she can see the algorithm adapting. */
export function snapshotPath(state: AppState, now: number): AppState {
  const path = buildPath(state, now);
  const last = state.pathHistory[state.pathHistory.length - 1];
  const snap = diffPath(last, path, now);
  if (last && snap.changes.length === 0) return state;
  return { ...state, pathHistory: [...state.pathHistory, snap].slice(-120) };
}

export function toggleTask(state: AppState, taskId: string, now: number): AppState {
  const key = dateKey(now);
  const done = state.tasksDone[key] ?? [];
  const next = done.includes(taskId) ? done.filter((t) => t !== taskId) : [...done, taskId];
  return { ...state, tasksDone: { ...state.tasksDone, [key]: next } };
}

export function streak(state: Pick<AppState, 'attempts'>, now: number): number {
  const days = new Set(state.attempts.map((a) => dateKey(a.at)));
  let n = 0;
  let t = now;
  if (!days.has(dateKey(t))) t -= DAY; // today not done yet — streak still alive from yesterday
  while (days.has(dateKey(t))) {
    n++;
    t -= DAY;
  }
  return n;
}

export function chapterName(id: string) {
  return CHAPTER_BY_ID[id]?.name ?? id;
}
