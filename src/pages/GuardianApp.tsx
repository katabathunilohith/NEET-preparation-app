import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { listStudents, setRole, type StudentSummary } from '../cloud/api';
import { useAuth } from '../cloud/auth';
import { Layout } from '../components/Layout';
import { buildPath } from '../engine/path';
import { migrate, streak } from '../engine/state';
import { ReadOnlyStoreProvider } from '../store/store';
import { fmtDate, fmtRank } from '../util';
import { ChapterPage } from './ChapterPage';
import { Dashboard } from './Dashboard';
import { MistakesPage } from './MistakesPage';
import { PathPage } from './PathPage';
import { TestResultPage } from './TestResultPage';
import { TestsPage } from './TestsPage';
import { TopicsPage } from './TopicsPage';

/** Read-only view for parents/guardians the student has invited. */
export function GuardianApp() {
  const { session, signOut, refreshProfile } = useAuth();
  const [students, setStudents] = useState<StudentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const navigate = useNavigate();
  const email = session?.user.email ?? '';

  useEffect(() => {
    listStudents(email).then(setStudents).catch((e) => setError(e.message));
  }, [email]);

  const current = students?.find((s) => s.id === active);
  if (current?.state) {
    return (
      <ReadOnlyStoreProvider state={migrate(current.state, Date.now())}>
        <Routes>
          <Route element={<Layout guardian={{ studentName: current.name, onExit: () => { setActive(null); navigate('/'); } }} />}>
            <Route index element={<Dashboard />} />
            <Route path="path" element={<PathPage />} />
            <Route path="topics" element={<TopicsPage />} />
            <Route path="topics/:id" element={<ChapterPage />} />
            <Route path="tests" element={<TestsPage />} />
            <Route path="tests/:id" element={<TestResultPage />} />
            <Route path="mistakes" element={<MistakesPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </ReadOnlyStoreProvider>
    );
  }

  const now = Date.now();
  return (
    <div className="auth">
      <div className="auth-panel wide">
        <div className="row between">
          <div className="wordmark">NEET Pathfinder</div>
          <button className="link-btn small" onClick={signOut}>Sign out</button>
        </div>
        <h1>Students you follow</h1>
        <p className="muted">Signed in as {email}. You can see progress but cannot change anything.</p>
        {error && <div className="callout bad">{error}</div>}
        {students === null && !error && <p className="muted">Loading…</p>}
        {students?.length === 0 && (
          <div className="callout">
            <strong>No students linked yet</strong>
            Ask the student to open Settings → Guardians and add <b>{email}</b>. Then reload this page.
          </div>
        )}
        <div className="table-wrap">
          {!!students?.length && (
            <table>
              <thead><tr><th>Student</th><th className="r">Predicted</th><th className="r">Est. rank</th><th className="r">Streak</th><th>Last active</th><th /></tr></thead>
              <tbody>
                {students.map((s) => {
                  const st = s.state ? migrate(s.state, now) : null;
                  const p = st ? buildPath(st, now) : null;
                  return (
                    <tr key={s.id}>
                      <td><strong>{s.name}</strong><div className="tiny muted">{s.email}</div></td>
                      <td className="r num">{p ? `${p.predicted}/720` : '–'}</td>
                      <td className="r num">{p ? fmtRank(p.predictedRank) : '–'}</td>
                      <td className="r num">{st ? `${streak(st, now)} d` : '–'}</td>
                      <td className="nowrap">{s.updatedAt ? fmtDate(new Date(s.updatedAt).getTime()) : 'Not started'}</td>
                      <td className="r">{st ? <button className="btn sm" onClick={() => setActive(s.id)}>Open</button> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <p className="small muted" style={{ marginTop: 24 }}>
          Preparing for NEET yourself?{' '}
          <button className="link-btn" onClick={async () => { await setRole(session!.user.id, 'student'); await refreshProfile(); }}>Switch to a student account</button>
        </p>
      </div>
    </div>
  );
}
