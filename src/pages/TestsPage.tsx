import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHAPTERS, SUBJECTS } from '../data/syllabus';
import { DAY } from '../engine/mastery';
import { dateKey } from '../engine/path';
import { customTest } from '../engine/testgen';
import { useStore } from '../store/store';
import type { Difficulty, Subject } from '../types';
import { fmtDate, fmtTime } from '../util';

export function TestsPage() {
  const { state, readOnly } = useStore();
  const navigate = useNavigate();
  const now = Date.now();
  const tests = [...state.tests].reverse();
  const dailyDone = state.tests.some((t) => t.kind === 'daily' && dateKey(t.startedAt) === dateKey(now));
  const lastWeekly = state.tests.filter((t) => t.kind === 'weekly').at(-1);
  const weeklyDue = !lastWeekly || now - lastWeekly.startedAt > 6 * DAY;

  const [subject, setSubject] = useState<Subject | 'all'>('all');
  const [chapter, setChapter] = useState('');
  const [count, setCount] = useState(20);
  const [diff, setDiff] = useState<Difficulty | ''>('');

  const startCustom = () => {
    const ids = chapter ? [chapter] : CHAPTERS.filter((c) => subject === 'all' || c.subject === subject).map((c) => c.id);
    const spec = customTest(state, ids, Math.max(5, Math.min(90, count)), diff || undefined, Date.now());
    navigate('/tests/run/custom', { state: { spec } });
  };

  const weekly = state.tests.filter((t) => t.kind === 'weekly').slice(-12).map((t) => ({ date: fmtDate(t.startedAt), Score: Math.round((t.score / t.maxScore) * 720) }));

  return (
    <>
      <div className="page-head">
        <div><div className="eyebrow">Tests</div><h1>Tests</h1><p className="muted">Daily tests track day-to-day progress. The weekly test is the closest thing to the real paper.</p></div>
      </div>

      {!readOnly && (
        <div className="grid g3">
          <div className="card stack">
            <div className="row between"><h2 style={{ margin: 0 }}>Daily</h2>{dailyDone ? <span className="tag good">Done today</span> : <span className="tag warn">Not taken</span>}</div>
            <p className="small muted" style={{ margin: 0, flex: 1 }}>15 questions in 15 minutes, chosen from weak chapters and mistakes that are due.</p>
            <Link className="btn primary" to="/tests/run/daily">{dailyDone ? 'Take another' : 'Start'}</Link>
          </div>
          <div className="card stack">
            <div className="row between"><h2 style={{ margin: 0 }}>Weekly</h2>{weeklyDue ? <span className="tag warn">Due</span> : <span className="tag good">Done this week</span>}</div>
            <p className="small muted" style={{ margin: 0, flex: 1 }}>45 questions in 50 minutes, NEET pattern and marking. {lastWeekly ? `Last taken ${fmtDate(lastWeekly.startedAt)}.` : 'Not taken yet.'}</p>
            <Link className="btn primary" to="/tests/run/weekly">Start</Link>
          </div>
          <div className="card stack">
            <h2 style={{ margin: 0 }}>Custom</h2>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <select value={subject} onChange={(e) => { setSubject(e.target.value as Subject | 'all'); setChapter(''); }} aria-label="Subject">
                <option value="all">All subjects</option>
                {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
              </select>
              <select value={diff} onChange={(e) => setDiff(e.target.value as Difficulty | '')} aria-label="Difficulty">
                <option value="">Any level</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
              </select>
            </div>
            <select value={chapter} onChange={(e) => setChapter(e.target.value)} aria-label="Chapter">
              <option value="">All chapters</option>
              {CHAPTERS.filter((c) => subject === 'all' || c.subject === subject).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input type="number" min={5} max={90} value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="Number of questions" style={{ width: 80 }} />
              <button className="btn primary" style={{ flex: 1 }} onClick={startCustom}>Start</button>
            </div>
          </div>
        </div>
      )}

      {weekly.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>Weekly tests, scaled to 720</h2></div>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={weekly} margin={{ top: 18, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} />
              <YAxis domain={[0, 720]} ticks={[0, 180, 360, 540, 720]} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: 'var(--sunken)' }} />
              <Bar dataKey="Score" fill="var(--ink-2)" radius={[3, 3, 0, 0]} maxBarSize={32} label={{ position: 'top', fill: 'var(--ink-2)', fontSize: 11 }} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      <section className="section">
        <div className="section-head"><h2>History</h2><span className="tiny faint">{tests.length} tests</span></div>
        {tests.length === 0 ? <div className="empty">No tests yet.</div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Type</th><th className="r">Score</th><th className="r">Right</th><th className="r">Wrong</th><th className="r">Skipped</th><th className="r">Time</th></tr></thead>
              <tbody>
                {tests.map((t) => (
                  <tr key={t.id}>
                    <td className="nowrap"><Link to={`/tests/${t.id}`}>{fmtDate(t.startedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Link></td>
                    <td style={{ textTransform: 'capitalize' }}>{t.kind}</td>
                    <td className="r num"><strong>{t.score}</strong><span className="faint">/{t.maxScore}</span></td>
                    <td className="r num">{t.correct}</td>
                    <td className="r num">{t.wrong}</td>
                    <td className="r num">{t.skipped}</td>
                    <td className="r num">{fmtTime(t.durationSec)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
