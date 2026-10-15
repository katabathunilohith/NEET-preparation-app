import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Figure, MistakePicker, Seg, SubjectDot } from '../components/Bits';
import { QuestionView } from '../components/QuestionView';
import { CHAPTER_BY_ID, SUBJECTS } from '../data/syllabus';
import { questionMap } from '../engine/bank';
import { setAttemptMistake } from '../engine/state';
import { useStore } from '../store/store';
import { fmtDate, fmtTime, pct } from '../util';

export function TestResultPage() {
  const { id } = useParams();
  const { state, update, readOnly } = useStore();
  const [filter, setFilter] = useState<'all' | 'wrong' | 'skipped'>('wrong');
  const t = state.tests.find((x) => x.id === id);
  if (!t) return <div className="empty">Test not found. <Link to="/tests">Back to tests</Link></div>;
  const qmap = questionMap(state);
  const prev = state.tests.filter((x) => x.kind === t.kind && x.startedAt < t.startedAt).at(-1);
  const delta = prev ? Math.round((t.score / t.maxScore - prev.score / prev.maxScore) * 100) : null;

  const attemptFor = (qid: string) => state.attempts.find((a) => a.qid === qid && a.mode === t.kind && a.at >= t.startedAt && a.correct === false);

  const rows = t.questionIds.map((qid, i) => ({ qid, i, q: qmap[qid], a: t.answers[i] })).filter((r) => {
    if (!r.q) return false;
    if (filter === 'wrong') return r.a !== null && r.a !== r.q.answer;
    if (filter === 'skipped') return r.a === null;
    return true;
  });

  // Chapter-level breakdown of where marks were lost.
  const lost: Record<string, number> = {};
  t.questionIds.forEach((qid, i) => {
    const q = qmap[qid];
    if (!q) return;
    if (t.answers[i] === null) lost[q.chapterId] = (lost[q.chapterId] ?? 0) + 4;
    else if (t.answers[i] !== q.answer) lost[q.chapterId] = (lost[q.chapterId] ?? 0) + 5;
  });
  const lostList = Object.entries(lost).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{fmtDate(t.startedAt, { weekday: 'long', day: 'numeric', month: 'long' })} · {fmtTime(t.durationSec)}</div>
          <h1>{t.kind === 'weekly' ? 'Weekly' : t.kind === 'daily' ? 'Daily' : 'Custom'} test</h1>
        </div>
        {!readOnly && <Link to="/path" className="btn">See updated path</Link>}
      </div>
      <div className="strip">
        <Figure label="Score" value={t.score} unit={`/${t.maxScore}`} sub={`About ${Math.round((t.score / t.maxScore) * 720)}/720 scaled`} />
        <Figure label="Accuracy" value={pct(t.correct / Math.max(1, t.correct + t.wrong))} sub="Of questions attempted" />
        <Figure label="Right · wrong · skipped" value={`${t.correct} · ${t.wrong} · ${t.skipped}`} sub={`${t.wrong} marks lost to negative marking`} />
        <Figure label={`Vs last ${t.kind} test`} value={delta === null ? '–' : `${delta >= 0 ? '+' : '−'}${Math.abs(delta)}`} unit={delta === null ? undefined : 'pts'} sub="Percentage points" />
      </div>

      <div className="grid g2 section">
        <section>
          <div className="section-head"><h2>By subject</h2></div>
          <table>
            <thead><tr><th>Subject</th><th className="r">Score</th><th className="r">Right</th><th className="r">Wrong</th><th className="r">Skipped</th></tr></thead>
            <tbody>
              {SUBJECTS.filter((s) => t.bySubject[s].max > 0).map((s) => (
                <tr key={s}><td><span className="row" style={{ gap: 8 }}><SubjectDot subject={s} />{s}</span></td><td className="r num">{t.bySubject[s].score}<span className="faint">/{t.bySubject[s].max}</span></td><td className="r num">{t.bySubject[s].correct}</td><td className="r num">{t.bySubject[s].wrong}</td><td className="r num">{t.bySubject[s].skipped}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
        <section>
          <div className="section-head"><h2>Where marks were lost</h2><span className="tiny faint">Wrong = 5, skipped = 4</span></div>
          {lostList.length === 0 ? <p className="muted">No marks lost.</p> : (
            <table>
              <tbody>
                {lostList.map(([cid, m]) => (
                  <tr key={cid}>
                    <td><span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}><SubjectDot subject={CHAPTER_BY_ID[cid].subject} /><Link to={`/topics/${cid}`}>{CHAPTER_BY_ID[cid].name}</Link></span></td>
                    <td className="r num" style={{ color: 'var(--bad)' }}>−{m}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>Review</h2>
          <Seg label="Filter" value={filter} onChange={setFilter} options={[['wrong', 'Wrong'], ['skipped', 'Skipped'], ['all', 'All']]} />
        </div>
        <div className="stack">
          {rows.length === 0 && <div className="empty">Nothing in this filter.</div>}
          {rows.map(({ qid, i, q, a }) => {
            const att = attemptFor(qid);
            return (
              <div key={qid} className="card">
                <QuestionView q={q} index={i} selected={a} reveal />
                {att && !readOnly && (
                  <div style={{ marginTop: 14 }}>
                    <MistakePicker value={att.mistake} onChange={(type) => update((s) => setAttemptMistake(s, qid, att.at, type))} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
