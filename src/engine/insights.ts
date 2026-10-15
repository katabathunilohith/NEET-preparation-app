import { CHAPTER_BY_ID, SUBJECTS } from '../data/syllabus';
import type { AppState, Difficulty, MistakeType } from '../types';
import { questionMap } from './bank';
import { MISTAKE_LABEL, MISTAKE_TYPES } from './mastery';
import { STRATEGY } from './path';

export interface Insight {
  tone: 'good' | 'warn' | 'info';
  title: string;
  text: string;
}

/** Patterns learned from all her answers so far. */
export function insights(state: AppState): Insight[] {
  const out: Insight[] = [];
  const attempts = state.attempts.filter((a) => a.correct !== null);
  if (attempts.length < 10) {
    return [{ tone: 'info', title: 'Not enough data yet', text: 'After about 10 answers (one daily test is enough) patterns in timing, accuracy and mistakes will show here.' }];
  }
  const qmap = questionMap(state);

  // Mistake profile
  const counts = Object.fromEntries(MISTAKE_TYPES.map((t) => [t, 0])) as Record<MistakeType, number>;
  for (const a of state.attempts.slice(-300)) if (a.mistake) counts[a.mistake]++;
  const totalMistakes = Object.values(counts).reduce((a, b) => a + b, 0);
  if (totalMistakes >= 5) {
    const top = MISTAKE_TYPES.reduce((a, b) => (counts[b] > counts[a] ? b : a));
    out.push({
      tone: 'warn',
      title: `${Math.round((counts[top] / totalMistakes) * 100)}% of mistakes: ${MISTAKE_LABEL[top].toLowerCase()}`,
      text: STRATEGY[top],
    });
  }

  // Difficulty profile
  const byDiff: Record<Difficulty, [number, number]> = { easy: [0, 0], medium: [0, 0], hard: [0, 0] };
  for (const a of attempts.slice(-400)) {
    const q = qmap[a.qid];
    if (!q) continue;
    byDiff[q.difficulty][1]++;
    if (a.correct) byDiff[q.difficulty][0]++;
  }
  const acc = (d: Difficulty) => (byDiff[d][1] ? byDiff[d][0] / byDiff[d][1] : NaN);
  if (byDiff.easy[1] >= 5 && acc('easy') < 0.8)
    out.push({ tone: 'warn', title: `Easy questions: only ${Math.round(acc('easy') * 100)}% correct`, text: 'Easy questions are free marks in NEET. Losing them usually means rushing or NCERT gaps — slow down on the first read.' });
  if (byDiff.hard[1] >= 5 && acc('hard') > 0.6)
    out.push({ tone: 'good', title: `Strong on hard questions (${Math.round(acc('hard') * 100)}%)`, text: 'Your problem-solving is solid. The app will push more hard questions to stretch you.' });

  // Fatigue: accuracy in first vs second half of tests
  const tests = state.tests.filter((t) => t.questionIds.length >= 10).slice(-8);
  if (tests.length >= 2) {
    let f = [0, 0], s = [0, 0];
    for (const t of tests) {
      const half = Math.floor(t.questionIds.length / 2);
      t.questionIds.forEach((qid, i) => {
        const q = qmap[qid];
        const a = t.answers[i];
        if (!q || a === null) return;
        const bucket = i < half ? f : s;
        bucket[1]++;
        if (a === q.answer) bucket[0]++;
      });
    }
    const fa = f[0] / Math.max(1, f[1]);
    const sa = s[0] / Math.max(1, s[1]);
    if (f[1] > 10 && s[1] > 10 && fa - sa > 0.12)
      out.push({ tone: 'warn', title: 'Accuracy drops late in tests', text: `${Math.round(fa * 100)}% in the first half vs ${Math.round(sa * 100)}% in the second. Build stamina with full weekly tests and take a 10-second reset every 15 questions.` });
    const negative = tests.reduce((s2, t) => s2 + t.wrong, 0);
    if (negative >= 8)
      out.push({ tone: 'info', title: `${negative} marks lost to negative marking`, text: `Across your last ${tests.length} tests. Skipping pure guesses could have saved many of these.` });
  }

  // Speed per subject
  for (const subject of SUBJECTS) {
    const stats = Object.values(state.stats).filter((s) => CHAPTER_BY_ID[s.chapterId]?.subject === subject && s.attempts >= 3);
    if (!stats.length) continue;
    const ratio = stats.reduce((a, s) => a + s.avgTimeRatio * s.attempts, 0) / stats.reduce((a, s) => a + s.attempts, 0);
    if (ratio > 1.5) out.push({ tone: 'warn', title: `${subject}: ${Math.round((ratio - 1) * 100)}% slower than NEET pace`, text: 'Time management decides NEET ranks. Practise this subject with the timer on.' });
    else if (ratio < 0.7) out.push({ tone: 'good', title: `${subject}: fast and fluent`, text: 'You are well ahead of NEET pace here — use the saved time for tougher subjects.' });
  }

  // Improvement
  const recentTests = state.tests.slice(-6);
  if (recentTests.length >= 4) {
    const pct = (t: (typeof recentTests)[number]) => t.score / Math.max(1, t.maxScore);
    const early = (pct(recentTests[0]) + pct(recentTests[1])) / 2;
    const late = (pct(recentTests[recentTests.length - 1]) + pct(recentTests[recentTests.length - 2])) / 2;
    if (late - early > 0.05) out.push({ tone: 'good', title: `Scores up ${Math.round((late - early) * 100)} points`, text: 'The last two tests are clearly ahead of the first two. The current routine is working.' });
    else if (early - late > 0.05) out.push({ tone: 'warn', title: 'Scores dipped recently', text: 'Look at the focus chapters on your Path — the plan has already shifted toward them.' });
  }
  return out.slice(0, 6);
}
