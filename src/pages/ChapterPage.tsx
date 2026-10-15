import { Link, useParams } from 'react-router-dom';
import { Figure, LevelBadge, MasteryBar, SubjectDot } from '../components/Bits';
import { CHAPTER_BY_ID } from '../data/syllabus';
import { questionsByChapter } from '../engine/bank';
import { generatorsFor, ratingKey } from '../engine/generators';
import { MISTAKE_LABEL, MISTAKE_TYPES, effectiveRating } from '../engine/mastery';
import { useStore } from '../store/store';
import { SUBJECT_COLOR, fmtDate, pct } from '../util';

const KIND_LABEL = { numeric: 'Numerical', recall: 'Fact recall', reasoning: 'Reasoning' } as const;

export function ChapterPage() {
  const { id = '' } = useParams();
  const { state, path, readOnly } = useStore();
  const ch = CHAPTER_BY_ID[id];
  if (!ch) return <div className="empty">Chapter not found. <Link to="/topics">Back to chapters</Link></div>;
  const plan = path.chapters.find((c) => c.chapter.id === id)!;
  const rank = path.chapters.findIndex((c) => c.chapter.id === id) + 1;
  const st = state.stats[id];
  const qs = questionsByChapter(state)[id] ?? [];
  const gens = generatorsFor(id);
  const history = state.attempts.filter((a) => a.chapterId === id);
  const lastResult: Record<string, boolean | null> = {};
  for (const a of history) lastResult[ratingKey(a.qid)] = a.correct;
  const genAttempts = history.filter((a) => a.qid.startsWith('gen:')).length;
  const now = Date.now();
  const maxMistake = st ? Math.max(1, ...MISTAKE_TYPES.map((x) => st.mistakes[x])) : 1;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow row" style={{ gap: 8 }}><SubjectDot subject={ch.subject} />{ch.subject} · {ch.unit} · Class {ch.classLevel}</div>
          <h1>{ch.name}</h1>
          <div className="row small muted" style={{ gap: 16 }}><LevelBadge level={plan.level} /><span>About {ch.weight} NEET questions a year</span><span>Priority {rank} of {path.chapters.length}</span></div>
        </div>
        {!readOnly && (
          <div className="row">
            <Link className="btn primary" to={`/practice/${id}?n=10`}>Practise 10</Link>
            <Link className="btn" to={`/practice/${id}?n=5&diff=hard`}>Hard only</Link>
          </div>
        )}
      </div>

      <div className="strip">
        <Figure label="Mastery" value={pct(plan.mastery)} sub={`Target ${pct(plan.target)}`} />
        <Figure label="Answered" value={st?.attempts ?? 0} sub={st?.attempts ? `${pct(st.correct / st.attempts)} correct` : 'None yet'} />
        <Figure label="Pace" value={st?.attempts ? st.avgTimeRatio.toFixed(1) : '–'} unit={st?.attempts ? '×' : undefined} sub="Time vs NEET pace" />
        <Figure label="Memory" value={Math.round(st?.stability ?? 3)} unit="days" sub={st?.lastAt ? `Last practised ${fmtDate(st.lastAt)}` : 'Not practised'} />
      </div>
      <div style={{ marginTop: 14 }}><MasteryBar value={plan.mastery} target={plan.target} color={SUBJECT_COLOR[ch.subject]} /></div>

      <div className="grid g2 section" style={{ alignItems: 'start' }}>
        <section>
          <div className="section-head"><h2>Approach</h2></div>
          <p>{plan.advice}</p>
          {plan.reasons.length > 0 && <ul className="small muted" style={{ paddingLeft: 18 }}>{plan.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
          <p className="tiny faint">Ability rating {Math.round(st ? effectiveRating(st, now) : 1350)} · estimate confidence {pct(plan.confidence)}</p>

          <div className="section-head" style={{ marginTop: 28 }}><h2>Mistake pattern</h2></div>
          {!st || MISTAKE_TYPES.every((t) => st.mistakes[t] === 0) ? (
            <p className="small faint">No mistakes recorded in this chapter.</p>
          ) : (
            <table>
              <tbody>
                {MISTAKE_TYPES.filter((t) => st.mistakes[t] > 0).sort((a, b) => st.mistakes[b] - st.mistakes[a]).map((t) => (
                  <tr key={t}>
                    <td style={{ width: 140 }}>{MISTAKE_LABEL[t]}</td>
                    <td><MasteryBar value={st.mistakes[t] / maxMistake} color="var(--bad)" /></td>
                    <td className="r num" style={{ width: 32 }}>{st.mistakes[t]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <div className="section-head"><h2>Questions</h2><span className="tiny faint">{qs.length} fixed{gens.length ? ` · ${gens.length} generators` : ''}</span></div>
          <table>
            <thead><tr><th>Concept</th><th>Source</th><th>Level</th><th className="r">Last</th></tr></thead>
            <tbody>
              {qs.map((q) => (
                <tr key={q.id}>
                  <td>{q.concept}</td>
                  <td className="small faint">{q.shared ? 'Shared' : q.custom ? 'Yours' : 'Built-in'}</td>
                  <td className="small" style={{ textTransform: 'capitalize' }}>{q.difficulty}</td>
                  <td className="r small">{lastResult[q.id] === undefined ? <span className="faint">–</span> : lastResult[q.id] ? <span className="tag good">Right</span> : <span className="tag bad">Wrong</span>}</td>
                </tr>
              ))}
              {gens.map((g) => (
                <tr key={g.id}>
                  <td>{g.concept}</td>
                  <td className="small faint">Generated · {KIND_LABEL[g.kind]}</td>
                  <td className="small" style={{ textTransform: 'capitalize' }}>{g.difficulty}</td>
                  <td className="r small">{lastResult[`gen:${g.id}`] === undefined ? <span className="faint">–</span> : lastResult[`gen:${g.id}`] ? <span className="tag good">Right</span> : <span className="tag bad">Wrong</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {gens.length > 0 && (
            <p className="tiny faint" style={{ marginTop: 10 }}>
              Generators make a fresh variant every time, with new numbers or new fact pairings. Practice favours the kind that matches the most frequent mistake here. {genAttempts} generated questions answered so far.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
