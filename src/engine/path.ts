import { CHAPTERS, CHAPTER_BY_ID, chapterShare } from '../data/syllabus';
import type { AppState, Chapter, MistakeType, PathSnapshot } from '../types';
import { DAY, confidence, dominantMistake, levelOf, mastery, trend, type Level, MISTAKE_LABEL } from './mastery';
import { accuracyForMarks, marksForRank, predictedMarks, rankForMarks } from './predict';
import { dueCards } from './srs';

export type Stage = 'fix' | 'build' | 'polish';

export interface ChapterPlan {
  chapter: Chapter;
  mastery: number;
  target: number;
  confidence: number;
  level: Level;
  stage: Stage;
  /** Marks she could gain in NEET by bringing this chapter to target. */
  potentialMarks: number;
  priority: number;
  reasons: string[];
  advice: string;
  dominant: MistakeType | null;
}

export interface Week {
  index: number;
  start: number;
  focus: string[];
  goalMarks: number;
}

export interface DailyTask {
  id: string;
  title: string;
  detail: string;
  kind: 'review' | 'practice' | 'daily' | 'weekly' | 'revise';
  link: string;
}

export interface StudyPath {
  targetMarks: number;
  targetAccuracy: number;
  predicted: number;
  predictedRank: number;
  daysLeft: number;
  chapters: ChapterPlan[];
  fix: ChapterPlan[];
  build: ChapterPlan[];
  polish: ChapterPlan[];
  weeks: Week[];
  today: DailyTask[];
  focus: string[];
}

export const STRATEGY: Record<MistakeType, string> = {
  concept:
    'Re-read the NCERT section and solved examples, write the core principle in your own words, then climb from easy to medium questions.',
  memory:
    'Make one-page notes of NCERT lines, tables and exceptions. Revise them with the Mistake Notebook every 2–3 days.',
  calculation:
    'Slow down and write each step. Check units, signs and powers of 10. Do a timed set of 10 numericals daily.',
  misread:
    'Underline NOT / EXCEPT / INCORRECT and the units asked. Re-read the stem before marking — you are answering too fast.',
  guess:
    'Guesses cost −1 each. Attempt only when you can eliminate two options; otherwise skip and revise the topic.',
  time:
    'Build speed: keep a formula / fact sheet, learn shortcuts, and practise 50-second drills on this chapter.',
};

function dateKey(t: number) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export { dateKey };

export function daysUntil(examDate: string, now: number): number {
  const exam = new Date(`${examDate}T09:00:00`).getTime();
  return Math.max(0, Math.ceil((exam - now) / DAY));
}

export function planChapter(state: Pick<AppState, 'stats'>, ch: Chapter, targetAcc: number, now: number): ChapterPlan {
  const stat = state.stats[ch.id];
  const m = mastery(stat, now);
  const conf = confidence(stat);
  const level = levelOf(stat, now);
  // High-weightage chapters must be stronger than average.
  const target = Math.min(0.97, targetAcc + 0.04 * (ch.weight - 2));
  const gap = Math.max(0, target - m);
  const share = chapterShare(ch) * 180;
  const potentialMarks = share * 5 * gap;
  const reasons: string[] = [];
  let priority = potentialMarks;

  if (!stat || stat.attempts < 3) {
    priority += share * 1.2;
    reasons.push('Not enough practice yet to judge — needs a diagnostic');
  }
  const recentWrong = stat ? stat.recent.slice(-5).filter((x) => x === 0).length : 0;
  if (recentWrong >= 2) {
    priority *= 1 + recentWrong * 0.12;
    reasons.push(`${recentWrong} of the last 5 answers were wrong`);
  }
  const tr = trend(stat);
  if (tr < -0.15) {
    priority *= 1.25;
    reasons.push('Accuracy is dropping lately');
  } else if (tr > 0.2) {
    reasons.push('Improving steadily');
  }
  if (stat?.lastAt) {
    const idle = (now - stat.lastAt) / DAY;
    if (idle > stat.stability * 1.5 && m > 0.5) {
      priority += share * 0.8;
      reasons.push(`Not revised for ${Math.round(idle)} days — memory fading`);
    }
  }
  if (ch.weight >= 4) reasons.push('High-weightage chapter');
  const dominant = dominantMistake(stat);
  if (dominant && stat && stat.mistakes[dominant] >= 2) reasons.push(`Most mistakes: ${MISTAKE_LABEL[dominant].toLowerCase()}`);
  if (stat && stat.avgTimeRatio > 1.6 && stat.attempts >= 4) reasons.push('Taking too long per question');

  const stage: Stage = m < Math.min(0.5, target - 0.2) || level === 'new' ? 'fix' : m < target ? 'build' : 'polish';
  const advice =
    stage === 'polish'
      ? 'At target — keep it fresh with mixed questions every ~10 days.'
      : dominant
        ? STRATEGY[dominant]
        : level === 'new'
          ? 'Start with the NCERT chapter summary, then take 10 practice questions so the app can diagnose your level.'
          : STRATEGY.concept;

  return { chapter: ch, mastery: m, target, confidence: conf, level, stage, potentialMarks, priority, reasons, advice, dominant };
}

/** Builds the full personalised path. Pure function — recomputed whenever data changes. */
export function buildPath(state: AppState, now: number): StudyPath {
  const targetMarks = marksForRank(state.profile.targetRank);
  const targetAccuracy = accuracyForMarks(targetMarks);
  const chapters = CHAPTERS.map((ch) => planChapter(state, ch, targetAccuracy, now)).sort((a, b) => b.priority - a.priority);
  const predicted = predictedMarks(state, now);
  const daysLeft = daysUntil(state.profile.examDate, now);

  const fix = chapters.filter((c) => c.stage === 'fix');
  const build = chapters.filter((c) => c.stage === 'build');
  const polish = chapters.filter((c) => c.stage === 'polish');

  // Weekly roadmap: weak chapters first, interleaving subjects so no week is one-sided.
  const queue = interleave([...fix, ...build]);
  const totalWeeks = Math.max(1, Math.min(24, Math.ceil(daysLeft / 7)));
  const revisionWeeks = totalWeeks > 4 ? 2 : totalWeeks > 1 ? 1 : 0;
  const learningWeeks = Math.max(1, totalWeeks - revisionWeeks);
  const perWeek = Math.max(2, Math.ceil(queue.length / learningWeeks));
  const weeks: Week[] = [];
  for (let i = 0; i < totalWeeks; i++) {
    const isRevision = i >= learningWeeks;
    const focus = isRevision
      ? chapters.filter((c) => c.chapter.weight >= 3).slice(0, 6).map((c) => c.chapter.id)
      : queue.slice(i * perWeek, (i + 1) * perWeek).map((c) => c.chapter.id);
    const progress = (i + 1) / Math.max(1, learningWeeks);
    weeks.push({
      index: i + 1,
      start: now + i * 7 * DAY,
      focus,
      goalMarks: Math.round(predicted + (targetMarks - predicted) * Math.min(1, progress)),
    });
  }

  const focus = queue.slice(0, 3).map((c) => c.chapter.id);
  const today = buildToday(state, chapters, focus, now);
  return { targetMarks, targetAccuracy, predicted, predictedRank: rankForMarks(predicted), daysLeft, chapters, fix, build, polish, weeks, today, focus };
}

function interleave(list: ChapterPlan[]): ChapterPlan[] {
  const bySubject: Record<string, ChapterPlan[]> = {};
  for (const c of list) (bySubject[c.chapter.subject] ??= []).push(c);
  // Biology carries half the paper, so it gets two slots per round.
  const order = ['Biology', 'Physics', 'Biology', 'Chemistry'];
  const out: ChapterPlan[] = [];
  while (out.length < list.length) {
    for (const s of order) {
      const next = bySubject[s]?.shift();
      if (next) out.push(next);
    }
  }
  return out;
}

function buildToday(state: AppState, chapters: ChapterPlan[], focus: string[], now: number): DailyTask[] {
  const tasks: DailyTask[] = [];
  const due = dueCards(state, now).length;
  if (due > 0)
    tasks.push({ id: 'review', kind: 'review', title: `Review ${due} due mistake${due > 1 ? 's' : ''}`, detail: 'Spaced repetition of questions you got wrong earlier.', link: '/mistakes' });
  const perTopic = Math.max(5, Math.round(state.profile.dailyGoal / Math.max(1, focus.length)));
  for (const id of focus) {
    const plan = chapters.find((c) => c.chapter.id === id)!;
    tasks.push({
      id: `practice:${id}`,
      kind: 'practice',
      title: `${CHAPTER_BY_ID[id].name}: ${perTopic} questions`,
      detail: plan.advice,
      link: `/practice/${id}?n=${perTopic}`,
    });
  }
  const today = dateKey(now);
  if (!state.tests.some((t) => t.kind === 'daily' && dateKey(t.startedAt) === today))
    tasks.push({ id: 'daily', kind: 'daily', title: 'Daily test', detail: '15 questions in 15 minutes, weighted toward weak chapters.', link: '/tests/run/daily' });
  const lastWeekly = Math.max(0, ...state.tests.filter((t) => t.kind === 'weekly').map((t) => t.startedAt));
  if (now - lastWeekly > 6 * DAY)
    tasks.push({ id: 'weekly', kind: 'weekly', title: 'Weekly test', detail: '45 questions, NEET pattern and marking, 50 minutes.', link: '/tests/run/weekly' });
  const fading = chapters.find((c) => c.stage === 'polish' && c.reasons.some((r) => r.startsWith('Not revised')));
  if (fading)
    tasks.push({ id: `revise:${fading.chapter.id}`, kind: 'revise', title: `${fading.chapter.name}: 5 revision questions`, detail: 'Strong here before, but it has not been revised for a while.', link: `/practice/${fading.chapter.id}?n=5` });
  return tasks;
}

/** Compares the new path with the last snapshot and explains what changed and why. */
export function diffPath(prev: PathSnapshot | undefined, path: StudyPath, now: number): PathSnapshot {
  const changes: string[] = [];
  const name = (id: string) => CHAPTER_BY_ID[id]?.name ?? id;
  if (!prev) {
    changes.push(`Path created: target ${path.targetMarks}/720, currently predicted ${path.predicted}/720.`);
  } else {
    const delta = path.predicted - prev.predictedMarks;
    if (Math.abs(delta) >= 2) changes.push(`Predicted score ${delta > 0 ? 'rose' : 'fell'} by ${Math.abs(delta)} marks to ${path.predicted}.`);
    if (path.targetMarks !== prev.targetMarks) changes.push(`Target updated to ${path.targetMarks}/720.`);
    for (const id of path.focus) {
      if (!prev.focus.includes(id)) {
        const plan = path.chapters.find((c) => c.chapter.id === id);
        changes.push(`${name(id)} moved into focus${plan?.reasons[0] ? `: ${plan.reasons[0].toLowerCase()}` : ''}.`);
      }
    }
    for (const id of prev.focus) {
      if (!path.focus.includes(id)) {
        const plan = path.chapters.find((c) => c.chapter.id === id);
        changes.push(`${name(id)} left focus (mastery ${Math.round((plan?.mastery ?? 0) * 100)}%).`);
      }
    }
  }
  return { at: now, targetMarks: path.targetMarks, predictedMarks: path.predicted, focus: path.focus, changes };
}
