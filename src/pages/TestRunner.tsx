import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { QuestionView } from '../components/QuestionView';
import { CHAPTER_BY_ID } from '../data/syllabus';
import { questionMap } from '../engine/bank';
import { submitTest } from '../engine/state';
import { dailyTest, testId, weeklyTest, type TestSpec } from '../engine/testgen';
import { useStore } from '../store/store';
import { fmtTime } from '../util';

const ACTIVE_KEY = 'neet-pathfinder:active-test';

interface Active {
  spec: TestSpec;
  answers: (number | null)[];
  times: number[];
  flagged: boolean[];
  startedAt: number;
  current: number;
}

function loadActive(kind: string): Active | null {
  try {
    const a = JSON.parse(localStorage.getItem(ACTIVE_KEY) ?? 'null') as Active | null;
    return a && a.spec.kind === kind && Date.now() - a.startedAt < a.spec.durationSec * 1000 + 3_600_000 ? a : null;
  } catch {
    return null;
  }
}

export function TestRunner() {
  const { kind = 'daily' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { state, path, update } = useStore();
  const qmap = useMemo(() => questionMap(state), [state]);
  const [active, setActive] = useState<Active | null>(() => loadActive(kind));
  const [spec] = useState<TestSpec>(() => {
    if (kind === 'custom' && (location.state as { spec?: TestSpec } | null)?.spec) return (location.state as { spec: TestSpec }).spec;
    return kind === 'weekly' ? weeklyTest(state, Date.now()) : dailyTest(state, path, Date.now());
  });
  const [now, setNow] = useState(Date.now());
  const qStart = useRef(Date.now());
  const finished = useRef(false);

  useEffect(() => {
    if (!active) return;
    try {
      localStorage.setItem(ACTIVE_KEY, JSON.stringify(active));
    } catch {
      /* best effort */
    }
  }, [active]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const commitTime = useCallback((a: Active): Active => {
    const t = Date.now();
    const times = [...a.times];
    times[a.current] += (t - qStart.current) / 1000;
    qStart.current = t;
    return { ...a, times };
  }, []);

  const finish = useCallback(
    (a: Active) => {
      if (finished.current) return;
      finished.current = true;
      const final = commitTime(a);
      const at = Date.now();
      update((s) => submitTest(s, final.spec, final.answers, final.times, final.startedAt, at).state);
      localStorage.removeItem(ACTIVE_KEY);
      navigate(`/tests/${testId(at)}`, { replace: true });
    },
    [commitTime, navigate, update],
  );

  const remaining = active ? active.spec.durationSec - (now - active.startedAt) / 1000 : 0;
  useEffect(() => {
    if (active && remaining <= 0) finish(active);
  }, [active, remaining, finish]);

  if (!active) {
    const s = spec;
    const subjects = s.questionIds.reduce<Record<string, number>>((acc, id) => {
      const subj = qmap[id] ? CHAPTER_BY_ID[qmap[id].chapterId].subject : '?';
      acc[subj] = (acc[subj] ?? 0) + 1;
      return acc;
    }, {});
    return (
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div className="eyebrow">Test</div>
        <h1>{s.title}</h1>
        <p className="muted">{s.questionIds.length} questions · {Math.round(s.durationSec / 60)} minutes · +4 correct, −1 wrong, 0 skipped.</p>
        <p className="small muted">{Object.entries(subjects).map(([k, v]) => `${k} ${v}`).join(' · ')}</p>
        <ul className="small muted" style={{ paddingLeft: 18 }}>
          {kind === 'daily' && <li>Most questions come from the current focus chapters and due mistakes; a few cover the rest of the syllabus.</li>}
          {kind === 'weekly' && <li>Same order and weighting as the paper: Physics, Chemistry, then Biology.</li>}
          <li>If two options can’t be ruled out, skipping is usually better than guessing.</li>
          <li>Flag questions to come back to. Closing the tab keeps your place; the test submits itself when time runs out.</li>
        </ul>
        {s.questionIds.length === 0 ? (
          <div className="callout warn">No questions available for this test.</div>
        ) : (
          <button
            className="btn primary block"
            onClick={() => {
              qStart.current = Date.now();
              const n = s.questionIds.length;
              setActive({ spec: s, answers: Array(n).fill(null), times: Array(n).fill(0), flagged: Array(n).fill(false), startedAt: Date.now(), current: 0 });
            }}
          >
            Start test
          </button>
        )}
        <div style={{ marginTop: 12 }}><Link to="/tests" className="small">Cancel</Link></div>
      </div>
    );
  }

  const a = active;
  const q = qmap[a.spec.questionIds[a.current]];
  const go = (idx: number) => setActive((x) => (x ? { ...commitTime(x), current: Math.max(0, Math.min(x.spec.questionIds.length - 1, idx)) } : x));
  const answered = a.answers.filter((x) => x !== null).length;

  const submit = () => {
    const left = a.spec.questionIds.length - answered;
    if (left > 0 && !window.confirm(`${left} question${left > 1 ? 's are' : ' is'} unanswered (scored 0). Submit now?`)) return;
    finish(a);
  };

  return (
    <div className="runner">
      <div className="card">
        {q ? (
          <QuestionView
            q={q}
            index={a.current}
            selected={a.answers[a.current]}
            reveal={false}
            onSelect={(i) => setActive((x) => {
              if (!x) return x;
              const answers = [...x.answers];
              answers[x.current] = answers[x.current] === i ? null : i;
              return { ...x, answers };
            })}
          />
        ) : <div className="empty">Question unavailable</div>}
        <div className="row between" style={{ marginTop: 16 }}>
          <button className="btn sm" onClick={() => go(a.current - 1)} disabled={a.current === 0}>← Prev</button>
          <div className="row">
            <button className="btn sm" onClick={() => setActive((x) => {
              if (!x) return x;
              const flagged = [...x.flagged];
              flagged[x.current] = !flagged[x.current];
              return { ...x, flagged };
            })}>{a.flagged[a.current] ? 'Unflag' : 'Flag'}</button>
            <button className="btn sm" onClick={() => setActive((x) => {
              if (!x) return x;
              const answers = [...x.answers];
              answers[x.current] = null;
              return { ...x, answers };
            })}>Clear</button>
          </div>
          {a.current < a.spec.questionIds.length - 1 ? (
            <button className="btn primary sm" onClick={() => go(a.current + 1)}>Next →</button>
          ) : (
            <button className="btn primary sm" onClick={submit}>Submit</button>
          )}
        </div>
      </div>
      <aside className="card stack" style={{ position: 'sticky', top: 72 }}>
        <div className="row between">
          <strong>{a.spec.title}</strong>
          <span className={`timer${remaining < 120 ? ' low' : ''}`}>{fmtTime(remaining)}</span>
        </div>
        <div className="small muted">{answered}/{a.spec.questionIds.length} answered · {a.flagged.filter(Boolean).length} flagged</div>
        <div className="palette">
          {a.spec.questionIds.map((_, i) => (
            <button
              key={i}
              className={`${a.answers[i] !== null ? 'answered' : ''} ${a.flagged[i] ? 'flagged' : ''} ${i === a.current ? 'current' : ''}`}
              onClick={() => go(i)}
              aria-label={`Question ${i + 1}`}
            >{i + 1}</button>
          ))}
        </div>
        <button className="btn primary block" onClick={submit}>Submit test</button>
      </aside>
    </div>
  );
}
