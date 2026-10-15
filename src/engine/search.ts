import { CHAPTERS } from '../data/syllabus';
import type { AppState, Chapter, Question } from '../types';
import { allQuestions } from './bank';

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ');

export function tokens(q: string) {
  return norm(q).split(/\s+/).filter(Boolean);
}

export function searchChapters(query: string): Chapter[] {
  const toks = tokens(query);
  if (!toks.length) return [];
  return CHAPTERS.map((c) => {
    const name = norm(c.name), unit = norm(c.unit), kw = c.keywords.join(' '), subj = c.subject.toLowerCase();
    let score = 0;
    for (const t of toks) {
      if (name.includes(t)) score += 4;
      else if (kw.includes(t)) score += 3;
      else if (unit.includes(t)) score += 2;
      else if (subj.startsWith(t) || `class ${c.classLevel}` === t || String(c.classLevel) === t) score += 1;
      else score -= 2;
    }
    return { c, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.c);
}

export function searchQuestions(state: Pick<AppState, 'customQuestions'>, query: string, limit = 40): Question[] {
  const toks = tokens(query);
  if (!toks.length) return [];
  const out: Question[] = [];
  for (const q of allQuestions(state)) {
    const hay = norm(`${q.text} ${q.concept} ${q.options.join(' ')}`);
    if (toks.every((t) => hay.includes(t))) out.push(q);
    if (out.length >= limit) break;
  }
  return out;
}
