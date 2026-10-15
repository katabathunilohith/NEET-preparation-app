import { useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { PrivacyPage, TermsPage } from './pages/LegalPages';
import { useAuth } from './cloud/auth';
import { Layout } from './components/Layout';
import { ChapterPage } from './pages/ChapterPage';
import { Dashboard } from './pages/Dashboard';
import { GuardianApp } from './pages/GuardianApp';
import { LoginPage, OFFLINE_FLAG } from './pages/LoginPage';
import { MistakesPage } from './pages/MistakesPage';
import { Onboarding } from './pages/Onboarding';
import { PathPage } from './pages/PathPage';
import { PracticePage } from './pages/PracticePage';
import { SearchPage } from './pages/SearchPage';
import { SettingsPage } from './pages/SettingsPage';
import { TestResultPage } from './pages/TestResultPage';
import { TestRunner } from './pages/TestRunner';
import { TestsPage } from './pages/TestsPage';
import { TopicsPage } from './pages/TopicsPage';
import { StoreProvider, useStore } from './store/store';

export function Root() {
  const auth = useAuth();
  const { pathname } = useLocation();
  const [offline, setOffline] = useState(() => {
    try {
      return localStorage.getItem(OFFLINE_FLAG) === '1';
    } catch {
      return false;
    }
  });

  // Public pages (linked from Google's consent screen) — no sign-in needed.
  if (pathname === '/privacy') return <PrivacyPage />;
  if (pathname === '/terms') return <TermsPage />;
  if (auth.enabled && auth.loading) return <div className="splash">Loading…</div>;
  if (auth.enabled && !auth.session && !offline)
    return <LoginPage onOffline={() => { try { localStorage.setItem(OFFLINE_FLAG, '1'); } catch { /* ignore */ } setOffline(true); }} />;
  if (auth.session && auth.profile?.role === 'guardian') return <GuardianApp />;

  const userId = auth.session?.user.id;
  return (
    <StoreProvider key={userId ?? 'local'} userId={userId}>
      <StudentApp />
    </StoreProvider>
  );
}

function StudentApp() {
  const { state } = useStore();
  if (!state.profile.onboarded) return <Onboarding />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="path" element={<PathPage />} />
        <Route path="topics" element={<TopicsPage />} />
        <Route path="topics/:id" element={<ChapterPage />} />
        <Route path="practice/:chapterId" element={<PracticePage />} />
        <Route path="tests" element={<TestsPage />} />
        <Route path="tests/run/:kind" element={<TestRunner />} />
        <Route path="tests/:id" element={<TestResultPage />} />
        <Route path="mistakes" element={<MistakesPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
