import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { PracticeSession } from '../components/PracticeSession';
import { CHAPTER_BY_ID } from '../data/syllabus';
import { questionsByChapter } from '../engine/bank';
import { practiceSet } from '../engine/testgen';
import { useStore } from '../store/store';
import type { Difficulty } from '../types';

export function PracticePage() {
  const { chapterId = '' } = useParams();
  const [params] = useSearchParams();
  const { state } = useStore();
  const n = Math.min(50, Math.max(1, Number(params.get('n')) || 10));
  const diff = params.get('diff') as Difficulty | null;
  // Fix the question set when the session starts.
  const [ids] = useState(() => {
    if (diff) {
      const pool = (questionsByChapter(state)[chapterId] ?? []).filter((q) => q.difficulty === diff);
      return pool.sort(() => Math.random() - 0.5).slice(0, n).map((q) => q.id);
    }
    return practiceSet(state, chapterId, n, Date.now());
  });
  const ch = CHAPTER_BY_ID[chapterId];
  return <PracticeSession key={chapterId} ids={ids} mode="practice" title={ch ? ch.name : 'Practice'} backTo={ch ? `/topics/${chapterId}` : '/topics'} />;
}
