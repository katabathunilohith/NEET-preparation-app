import { Link, useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Figure, LevelBadge, MasteryBar, SubjectDot } from '../components/Bits';
import { SUBJECTS } from '../data/syllabus';
import { insights } from '../engine/insights';
import { DAY, MISTAKE_LABEL, MISTAKE_TYPES } from '../engine/mastery';
import { dateKey } from '../engine/path';
import { subjectMastery } from '../engine/predict';
import { dueCards } from '../engine/srs';
import { streak, toggleTask } from '../engine/state';
import { useStore } from '../store/store';
import { SUBJECT_COLOR, fmtDate, fmtRank, pct } from '../util';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function Dashboard() {
  const { state, path, update, readOnly } = useStore();
  const navigate = useNavigate();
  const now = Date.now();
  const done = state.tasksDone[dateKey(now)] ?? [];
  const recent = state.attempts.filter((a) => a.at > now - 7 * DAY && a.correct !== null);
  const acc7 = recent.length ? recent.filter((a) => a.correct).length / recent.length : 0;
  const todayCount = state.attempts.filter((a) => dateKey(a.at) === dateKey(now)).length;
  const subj = subjectMastery(state, now);
  const ins = insights(state);
  const name = state.profile.name || 'there';

  const testData = state.tests.slice(-20).map((t) => ({
    date: fmtDate(t.startedAt),
    Daily: t.kind === 'daily' ? Math.round((t.score / t.maxScore) * 100) : undefined,
    Weekly: t.kind === 'weekly' ? Math.round((t.score / t.maxScore) * 100) : undefined,
  }));
  const activity = Array.from({ length: 14 }, (_, i) => {
    const t = now - (13 - i) * DAY;
    const k = dateKey(t);
    return { day: fmtDate(t), Questions: state.attempts.filter((a) => dateKey(a.at) === k).length };
  });
  const mistakeCounts = MISTAKE_TYPES.map((t) => ({ t, n: state.attempts.filter((a) => a.mistake === t).length })).filter((m) => m.n > 0).sort((a, b) => b.n - a.n);
  const totalMistakes = mistakeCounts.reduce((s, m) => s + m.n, 0);
  const progress = Math.min(1, path.predicted / Math.max(1, path.targetMarks));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{fmtDate(now, { weekday: 'long', day: 'numeric', month: 'long' })} · {path.daysLeft} days to NEET</div>
          <h1>{readOnly ? `${name}’s overview` : `${greeting()}, ${name}`}</h1>
        </div>
        {!readOnly && <Link to="/path" className="btn">Open study path</Link>}
      </div>

      <div className="strip">
        <Figure label="Predicted score" value={path.predicted} unit="/720" sub={`Target ${path.targetMarks}`} />
        <Figure label="Estimated rank" value={fmtRank(path.predictedRank)} sub={`Goal ${fmtRank(state.profile.targetRank)}`} />
        <Figure label="Accuracy, 7 days" value={recent.length ? pct(acc7) : '–'} sub={`${recent.length} answered`} />
        <Figure label="Streak" value={streak(state, now)} unit="days" sub={`Today ${todayCount}/${state.profile.dailyGoal} questions`} />
        <Figure label="Mistakes due" value={dueCards(state, now).length} sub={readOnly ? 'for review' : <Link to="/mistakes">Review</Link>} />
      </div>
      <div style={{ marginTop: 14 }}>
        <MasteryBar value={progress} />
        <div className="tiny faint" style={{ marginTop: 6 }}>{pct(progress)} of target score. The estimate firms up as more questions are answered.</div>
      </div>

      <div className="grid g2 section">
        <section>
          <div className="section-head"><h2>Today</h2><span className="tiny faint">Rebuilt after every answer</span></div>
          {path.today.length === 0 && <div className="empty">Nothing left for today.</div>}
          {path.today.map((t) => (
            <div key={t.id} className={`task${done.includes(t.id) ? ' done' : ''}`}>
              <input type="checkbox" checked={done.includes(t.id)} disabled={readOnly} onChange={() => update((s, n) => toggleTask(s, t.id, n))} aria-label={`Mark “${t.title}” done`} />
              <div>
                <div className="task-title">{t.title}</div>
                <div className="small muted">{t.detail.split(/(?<=\.) /)[0]}</div>
              </div>
              {!readOnly && <button className="btn sm" onClick={() => navigate(t.link)}>Start</button>}
            </div>
          ))}
        </section>
        <section>
          <div className="section-head"><h2>Observations</h2><span className="tiny faint">From {state.attempts.length} answers</span></div>
          <div className="stack">
            {ins.map((i, k) => (
              <div key={k} className={`callout ${i.tone === 'good' ? 'good' : i.tone === 'warn' ? 'warn' : ''}`}>
                <strong>{i.title}</strong>
                <span className="small muted">{i.text}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid g2 section">
        <section>
          <div className="section-head"><h2>Test scores</h2><Link to="/tests" className="small">All tests</Link></div>
          {testData.length < 1 ? (
            <div className="empty">Scores appear here after the first daily or weekly test.</div>
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={testData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                <YAxis domain={[-25, 100]} ticks={[-25, 0, 25, 50, 75, 100]} tickLine={false} axisLine={false} unit="%" />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Legend iconType="plainline" />
                <Line type="monotone" dataKey="Daily" stroke="var(--ink)" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: 'var(--surface)' }} connectNulls />
                <Line type="monotone" dataKey="Weekly" stroke="var(--chemistry)" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: 'var(--surface)' }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          )}
        </section>
        <section>
          <div className="section-head"><h2>By subject</h2><span className="tiny faint">Tick = target accuracy</span></div>
          <table>
            <tbody>
              {SUBJECTS.map((s) => (
                <tr key={s}>
                  <td style={{ width: 120 }}><span className="row" style={{ gap: 8 }}><SubjectDot subject={s} />{s}</span></td>
                  <td><MasteryBar value={subj[s]} target={path.targetAccuracy} color={SUBJECT_COLOR[s]} /></td>
                  <td className="r num" style={{ width: 52 }}>{pct(subj[s])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 style={{ marginTop: 24 }}>Why answers go wrong</h3>
          {totalMistakes === 0 ? (
            <p className="small faint">No mistakes recorded yet.</p>
          ) : (
            <table>
              <tbody>
                {mistakeCounts.map((m) => (
                  <tr key={m.t}>
                    <td style={{ width: 140 }}>{MISTAKE_LABEL[m.t]}</td>
                    <td><MasteryBar value={m.n / mistakeCounts[0].n} color="var(--ink-2)" /></td>
                    <td className="r num" style={{ width: 52 }}>{pct(m.n / totalMistakes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <div className="grid g2 section">
        <section>
          <div className="section-head"><h2>Focus chapters</h2><Link to="/path" className="small">Full path</Link></div>
          <table>
            <thead><tr><th>Chapter</th><th>Level</th><th className="r">Mastery</th><th className="r">Gain</th></tr></thead>
            <tbody>
              {path.chapters.slice(0, 6).map((c) => (
                <tr key={c.chapter.id}>
                  <td><span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}><SubjectDot subject={c.chapter.subject} /><Link to={`/topics/${c.chapter.id}`}>{c.chapter.name}</Link></span></td>
                  <td><LevelBadge level={c.level} /></td>
                  <td className="r num">{pct(c.mastery)}</td>
                  <td className="r num" title="Marks available if this chapter reaches target">+{c.potentialMarks.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section>
          <div className="section-head"><h2>Questions per day</h2><span className="tiny faint">Last 14 days</span></div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={activity} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} interval={3} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: 'var(--sunken)' }} />
              <Bar dataKey="Questions" fill="var(--ink-2)" radius={[3, 3, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>
    </>
  );
}
