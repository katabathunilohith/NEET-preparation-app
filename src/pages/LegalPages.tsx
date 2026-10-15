import { Link } from 'react-router-dom';

const CONTACT = 'katabathuni.lohith@gmail.com';
const UPDATED = '15 October 2026';

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="auth">
      <article className="auth-panel wide legal">
        <Link to="/" className="wordmark" style={{ textDecoration: 'none' }}>NEET Pathfinder</Link>
        <h1 style={{ marginTop: 32 }}>{title}</h1>
        <p className="small faint">Last updated {UPDATED}</p>
        {children}
        <p className="small faint" style={{ marginTop: 32 }}><Link to="/privacy">Privacy policy</Link> · <Link to="/terms">Terms of service</Link> · <Link to="/">Back to the app</Link></p>
      </article>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <Shell title="Privacy policy">
      <p>NEET Pathfinder is a free study tool for NEET preparation. This page explains what data it keeps and why.</p>
      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details:</strong> your email address and, if you sign in with Google, your name as provided by Google. We do not receive your Google password.</li>
        <li><strong>Study data:</strong> your profile (name, exam date, target rank, daily goal), answers, test results, mistake notes, bookmarks and any questions you add.</li>
        <li><strong>Guardian emails:</strong> email addresses you choose to grant read-only access to your progress.</li>
      </ul>
      <h2>How it is used</h2>
      <p>Only to run the app: to build your study plan, show your progress, sync it between your devices, and let guardians you invited view it. We do not sell data, show ads, or use it for any other purpose.</p>
      <h2>Where it is stored</h2>
      <p>Data is saved in your browser and, when you are signed in, in our database hosted by Supabase. Access is protected so that only you, and guardians you added, can read your study data. Only you can change it.</p>
      <h2>Sharing</h2>
      <p>Your data is shared only with guardians you add, and with the service providers needed to run the app (Supabase for the database and sign-in, Google for “Continue with Google”, and the website host).</p>
      <h2>Your choices</h2>
      <ul>
        <li>Download all your data any time from Settings → Backup.</li>
        <li>Erase your progress from Settings → Reset, and remove guardians from Settings → Guardians.</li>
        <li>To delete your account entirely, email us and we will remove it within 30 days.</li>
      </ul>
      <h2>Children</h2>
      <p>Students under 18 should use the app with a parent’s or guardian’s knowledge.</p>
      <h2>Contact</h2>
      <p><a href={`mailto:${CONTACT}`}>{CONTACT}</a></p>
    </Shell>
  );
}

export function TermsPage() {
  return (
    <Shell title="Terms of service">
      <p>By using NEET Pathfinder you agree to these terms.</p>
      <h2>The service</h2>
      <p>NEET Pathfinder is a free practice and planning tool, provided as-is. It is not affiliated with the National Testing Agency (NTA) or any official NEET body.</p>
      <h2>No guarantees</h2>
      <p>Predicted scores and ranks are estimates based on past trends and your practice data. They are not guarantees of exam results. Questions and explanations are prepared carefully but may contain errors. Always check against NCERT and official sources.</p>
      <h2>Your account</h2>
      <p>Keep your sign-in method secure. You are responsible for questions you add and for whom you grant guardian access.</p>
      <h2>Acceptable use</h2>
      <p>Do not misuse the service, attempt to access other users’ data, or upload content you do not have the right to share.</p>
      <h2>Changes and availability</h2>
      <p>The service may change or be paused at any time. We may update these terms; continued use means you accept the updated version.</p>
      <h2>Contact</h2>
      <p><a href={`mailto:${CONTACT}`}>{CONTACT}</a></p>
    </Shell>
  );
}
