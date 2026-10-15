import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { questionMap } from '../engine/bank';
import { guessMistakeType, mastery } from '../engine/mastery';
import { CHAPTER_BY_ID } from '../data/syllabus';
import { recordAnswer, setAttemptMistake } from '../engine/state';
import { useStore } from '../store/store';
import type { MistakeType, Mode } from '../types';
import { fmtTime, pct } from '../util';
import { MistakePicker } from './Bits';
import { QuestionView } from './QuestionView';

interface Props {
  ids: string[];
  mode: Mode;
  title: string;
  backTo: string;
}

/** One-question-at-a-time practice with instant feedback; every answer feeds the learning engine. */
export function PracticeSession({ ids, mode, title, backTo }: Props) {
  const { state, update } = useStore();
  const custom = state.customQuestions;
  const qmap = useMemo(() => questionMap({ customQuestions: custom }), [custom]);
  const [i, setI] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answeredAt, setAnsweredAt] = useState<number | null>(null);
  const [mistake, setMistake] = useState<MistakeType | undefined>();
  const [results, setResults] = useState<boolean[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const start = useRef(Date.now());
  const chapters = useMemo(() => [...new Set(ids.map((id) => qmap[id]?.chapterId).filter(Boolean))], [ids, qmap]);
  const before = useRef(Object.fromEntries(chapters.map((c) => [c, mastery(state.stats[c], Date.now())])));

  const q = qmap[ids[i]];
  const finished = i >= ids.length;

  useEffect(() => {
    start.current = Date.now();
    setElapsed(0);
    const t = setInterval(() => setElapsed((Date.now() - start.current) / 1000), 1000);
    return () => clearInterval(t);
  }, [i]);

  const answer = (choice: number) => {
    if (answeredAt || !q) return;
    const now = Date.now();
    const time = (now - start.current) / 1000;
    const auto = choice === q.answer ? undefined : guessMistakeType(q, time);
    update((s) => recordAnswer(s, q, choice, time, mode, now, auto));
    setSelected(choice);
    setAnsweredAt(now);
    setResults((r) => [...r, choice === q.answer]);
    setMistake(auto);
  };

  const changeMistake = (t: MistakeType) => {
    if (!answeredAt || !q) return;
    setMistake(t);
    update((s) => setAttemptMistake(s, q.id, answeredAt, t));
  };

  const next = () => {
    setI((x) => x + 1);
    setSelected(null);
    setAnsweredAt(null);
    setMistake(undefined);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      if (!answeredAt && ['a', 'b', 'c', 'd', '1', '2', '3', '4'].includes(k)) answer('abcd'.includes(k) ? 'abcd'.indexOf(k) : Number(k) - 1);
      else if (answeredAt && (k === 'enter' || k === 'n')) next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!ids.length) return <div className="empty">No questions available here yet. <Link to={backTo}>Go back</Link></div>;

  if (finished) {
    const correct = results.filter(Boolean).length;
    const now = Date.now();
    return (
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1>Session complete</h1>
        <p className="muted">{correct} of {results.length} correct ({pct(correct / Math.max(1, results.length))}). The study path has been updated.</p>
        <div className="list">
          {chapters.map((c) => {
            const b = before.current[c] ?? 0;
            const a = mastery(state.stats[c], now);
            return (
              <div key={c} className="list-item">
                <span className="grow">{CHAPTER_BY_ID[c]?.name ?? c}</span>
                <span className="num small">{pct(b)} → <strong style={{ color: a >= b ? 'var(--good)' : 'var(--bad)' }}>{pct(a)}</strong> mastery</span>
              </div>
            );
          })}
        </div>
        <div className="row" style={{ marginTop: 16 }}>
          <Link className="btn primary" to="/path">See updated path</Link>
          <Link className="btn" to={backTo}>Back</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div className="row between" style={{ marginBottom: 12 }}>
        <div><h2 style={{ margin: 0 }}>{title}</h2><span className="small faint">Question {i + 1} of {ids.length} · A–D to answer, Enter for next</span></div>
        <span className="timer">{fmtTime(answeredAt ? (answeredAt - start.current) / 1000 : elapsed)}</span>
      </div>
      <div className="progress-line"><span style={{ width: `${(i / ids.length) * 100}%` }} /></div>
      <div className="card">
        {q ? (
          <QuestionView
            q={q}
            selected={selected}
            reveal={answeredAt !== null}
            onSelect={answer}
            bookmarked={state.bookmarks.includes(q.id)}
            onBookmark={() => update((s) => ({ ...s, bookmarks: s.bookmarks.includes(q.id) ? s.bookmarks.filter((b) => b !== q.id) : [...s.bookmarks, q.id] }))}
          />
        ) : (
          <div className="empty">This question was removed.</div>
        )}
        {answeredAt !== null && q && selected !== q.answer && (
          <div style={{ marginTop: 14 }}><MistakePicker value={mistake} onChange={changeMistake} /></div>
        )}
        <div className="row between" style={{ marginTop: 16 }}>
          <Link to={backTo} className="link-btn small">End session</Link>
          {answeredAt !== null || !q ? (
            <button className="btn primary" onClick={next}>{i + 1 === ids.length ? 'Finish' : 'Next →'}</button>
          ) : (
            <span className="small faint">Choose an option</span>
          )}
        </div>
      </div>
    </div>
  );
}
