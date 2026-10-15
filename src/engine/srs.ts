import type { AppState, MistakeCard, MistakeType } from '../types';
import { DAY } from './mastery';

/** Interval (days) after which a mistake counts as fixed and leaves the notebook. */
export const GRADUATE_DAYS = 30;

export function addMistake(cards: Record<string, MistakeCard>, qid: string, chapterId: string, type: MistakeType | undefined, now: number) {
  const prev = cards[qid];
  const card: MistakeCard = prev
    ? { ...prev, due: now + DAY, intervalDays: 1, lapses: prev.lapses + 1, ease: Math.max(1.3, prev.ease - 0.2), lastType: type ?? prev.lastType }
    : { qid, chapterId, addedAt: now, due: now + DAY, intervalDays: 1, ease: 2.3, reps: 0, lapses: 1, lastType: type };
  return { ...cards, [qid]: card };
}

/** SM-2 style scheduling after reviewing a mistake card. */
export function reviewMistake(cards: Record<string, MistakeCard>, qid: string, correct: boolean, now: number) {
  const card = cards[qid];
  if (!card) return cards;
  if (!correct) return addMistake(cards, qid, card.chapterId, card.lastType, now);
  const reps = card.reps + 1;
  const intervalDays = reps === 1 ? 3 : Math.round(card.intervalDays * card.ease);
  if (intervalDays >= GRADUATE_DAYS) {
    const rest = { ...cards };
    delete rest[qid];
    return rest;
  }
  return { ...cards, [qid]: { ...card, reps, intervalDays, ease: card.ease + 0.05, due: now + intervalDays * DAY } };
}

export function dueCards(state: Pick<AppState, 'mistakes'>, now: number): MistakeCard[] {
  return Object.values(state.mistakes)
    .filter((c) => c.due <= now)
    .sort((a, b) => a.due - b.due);
}
