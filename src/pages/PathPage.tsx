import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { Figure, LevelBadge, MasteryBar, Seg, SubjectDot } from '../components/Bits';
import { CHAPTER_BY_ID } from '../data/syllabus';
import type { Stage } from '../engine/path';
import { useStore } from '../store/store';
import { SUBJECT_COLOR, fmtDate, fmtRank, pct } from '../util';

const STAGES: { key: Stage; title: string; blurb: string }[] = [
  { key: 'fix', title: 'Fix foundations', blurb: 'Weak or not yet assessed. Rebuild the concepts from NCERT before working on speed.' },
  { key: 'build', title: 'Build to target', blurb: 'The basics are there. Raise accuracy to the level the target rank needs.' },
  { key: 'polish', title: 'Maintain', blurb: 'At target. Short spaced revision keeps these from fading.' },
];

export function PathPage() {
  const { state, path, readOnly } = useStore();
  const [stage, setStage] = useState<Stage>(path.fix.length ? 'fix' : path.build.length ? 'build' : 'polish');
  const [open, setOpen] = useState<string | null>(null);
  const history = [...state.pathHistory].reverse().slice(0, 12);
  const gap = path.targetMarks - path.predicted;
  const list = path[stage];
  const info = STAGES.find((s) => s.key === stage)!;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Study path</div>
          <h1>Route to rank {fmtRank(state.profile.targetRank)}</h1>
          <p className="muted">Needs about {path.targetMarks}/720, roughly {pct(path.targetAccuracy)} accuracy. Chapters are re-ranked after every answer.</p>
        </div>
        {!readOnly && <Link to="/settings" className="btn">Change target</Link>}
      </div>

      <div className="strip">
        <Figure label="Predicted now" value={path.predicted} unit="/720" sub={`Rank about ${fmtRank(path.predictedRank)}`} />
        <Figure label="Still to gain" value={gap > 0 ? `+${gap}` : '0'} unit="marks" sub={gap > 0 ? `About ${Math.ceil(gap / Math.max(1, path.daysLeft / 7))} a week` : 'On track — keep revising'} />
        <Figure label="Time left" value={path.daysLeft} unit="days" sub={`${path.weeks.length}-week plan`} />
        <Figure label="Chapters" value={`${path.fix.length} · ${path.build.length} · ${path.polish.length}`} sub="fix · build · maintain" />
      </div>

      <div className="section">
        <div className="section-head">
          <h2>Chapters in priority order</h2>
          <Seg label="Stage" value={stage} onChange={setStage} options={STAGES.map((s) => [s.key, `${s.title} (${path[s.key].length})`] as const)} />
        </div>
        <p className="small muted">{info.blurb}</p>
        {list.length === 0 ? <div className="empty">No chapters in this stage.</div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th style={{ width: 28 }}>#</th><th>Chapter</th><th>Level</th><th style={{ width: '22%' }}>Mastery vs target</th><th className="r">Gain</th></tr></thead>
              <tbody>
                {list.slice(0, 20).map((c, i) => (
                  <Fragment key={c.chapter.id}>
                    <tr onClick={() => setOpen(open === c.chapter.id ? null : c.chapter.id)} style={{ cursor: 'pointer' }} aria-expanded={open === c.chapter.id}>
                      <td className="num faint">{i + 1}</td>
                      <td><span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}><SubjectDot subject={c.chapter.subject} /><span>{c.chapter.name}</span></span>
                        {c.reasons[0] && <div className="tiny faint" style={{ marginLeft: 16 }}>{c.reasons[0]}</div>}</td>
                      <td><LevelBadge level={c.level} /></td>
                      <td><div className="row" style={{ flexWrap: 'nowrap', gap: 8 }}><div style={{ flex: 1 }}><MasteryBar value={c.mastery} target={c.target} color={SUBJECT_COLOR[c.chapter.subject]} /></div><span className="num tiny" style={{ width: 34, textAlign: 'right' }}>{pct(c.mastery)}</span></div></td>
                      <td className="r num">+{c.potentialMarks.toFixed(1)}</td>
                    </tr>
                    {open === c.chapter.id && (
                      <tr>
                        <td />
                        <td colSpan={4} style={{ paddingBottom: 16 }}>
                          {c.reasons.length > 1 && <ul className="small muted" style={{ margin: '0 0 8px', paddingLeft: 18 }}>{c.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
                          <div className="callout small"><strong>Approach</strong>{c.advice}</div>
                          {!readOnly && (
                            <div className="row" style={{ marginTop: 10 }}>
                              <Link className="btn primary sm" to={`/practice/${c.chapter.id}?n=10`}>Practise 10 questions</Link>
                              <Link className="btn sm" to={`/topics/${c.chapter.id}`}>Chapter details</Link>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list.length > 20 && <p className="tiny faint" style={{ marginTop: 8 }}>{list.length - 20} more will move up as these improve.</p>}
      </div>

      <div className="grid g2 section" style={{ alignItems: 'start' }}>
        <section>
          <div className="section-head"><h2>Week by week</h2><span className="tiny faint">Weekly test each Sunday</span></div>
          {path.weeks.slice(0, 10).map((w, i) => (
            <div key={w.index} className="week">
              <div>
                <div className="week-label">Week {w.index}{i === 0 && <span className="faint" style={{ fontWeight: 400 }}> · now</span>}</div>
                <div className="tiny faint">{fmtDate(w.start)}</div>
              </div>
              <div>
                <div className="week-focus">
                  {w.focus.map((id) => (
                    <Link key={id} to={`/topics/${id}`}><SubjectDot subject={CHAPTER_BY_ID[id].subject} />{CHAPTER_BY_ID[id].name}</Link>
                  ))}
                  {w.focus.length === 0 && <span className="muted">Full mock tests and revision</span>}
                </div>
                <div className="tiny faint" style={{ marginTop: 4 }}>Milestone: predicted score of {w.goalMarks} or more</div>
              </div>
            </div>
          ))}
          {path.weeks.length > 10 && <p className="tiny faint" style={{ marginTop: 8 }}>Later weeks are planned as these finish.</p>}
        </section>

        <section>
          <div className="section-head"><h2>Changes to the plan</h2></div>
          {history.length === 0 ? <div className="empty">Changes will be logged here as practice continues.</div> : (
            <div className="log">
              {history.map((h) => (
                <div key={h.at} className="log-entry">
                  <div className="tiny faint">{fmtDate(h.at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                  <ul className="small">{h.changes.map((c, i) => <li key={i}>{c}</li>)}</ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
