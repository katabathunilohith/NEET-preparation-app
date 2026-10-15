# NEET Pathfinder

An adaptive NEET practice app. It learns from every answer, finds where and why mistakes happen, makes new questions aimed at those weak spots, and keeps re-planning the route to a target rank.

Everything runs on free tiers: **Supabase Free** (login, database, sync) and **Vercel Hobby, Netlify or Cloudflare Pages** (hosting). No AI API keys and no paid services are used.

## What it does

- **Study path.** Give it a target rank and an exam date. It converts the rank into the marks and accuracy needed, ranks all 80 chapters into *Fix foundations → Build to target → Maintain*, and lays out a week-by-week plan. Every change to the plan is logged with the reason for it.
- **Adaptive engine.** Each chapter has an Elo-style ability rating with a forgetting curve. Each question's difficulty is learned from answers. Chapters are prioritised by NEET weightage, the gap to target, recent wrong answers, falling accuracy and fading memory.
- **Questions that generate themselves.** About 70 generators produce unlimited fresh variants: new numbers for numericals, new fact pairings for recall questions, and new distractors. The engine leans on them when:
  - mistakes in a chapter are mostly *calculation slips* or *too slow* (it serves more numericals),
  - mistakes are mostly *forgotten facts* (it serves more recall questions),
  - she has already seen most of the fixed questions for a chapter.

  When she gets a generated question wrong, the review brings it back **with different numbers**. That tests the concept, not a memorised answer.
- **Mistake analysis.** Each wrong answer is labelled automatically from timing and question type: concept gap, forgotten fact, calculation slip, misread question, guess, or too slow. She can correct the label, and the engine learns from the correction.
- **Tests.**
  - Daily adaptive test: 15 questions.
  - Weekly NEET-pattern test: 45 questions, +4/−1 marking, timer, question palette, auto-submit, and it resumes if the tab is closed.
  - Custom tests.
- **Overview.** Predicted score and rank, streak, today's plan, test trends, subject mastery, mistake profile, and observations such as fatigue late in tests or marks lost to negative marking.
- **Categories and search.** Group chapters by unit, by her level, by weightage or by class. Search covers chapters, concepts and question text.
- **Mistake notebook** with spaced repetition, plus bookmarks.
- **Accounts and sync.** Sign in with Google or an email link. Progress syncs across her phone and laptop, with live updates. The app still works offline and syncs when the connection comes back.
- **Guardian view.** She adds a parent's email in Settings → Guardians. The parent signs in and sees a read-only overview, study path, tests and mistakes.
- **Shared question bank.** Admins can publish questions that every device receives. Everyone can also keep questions for themselves only.

## Local development

```bash
npm install
npm run dev          # offline mode, http://localhost:5173
npm test             # engine + generator tests
npm run build
```

To run with cloud features locally (needs Docker):

```bash
npx supabase start   # local Postgres + Auth + Realtime, applies supabase/migrations
```

Copy the printed `API URL` and `anon key` into `.env.local`:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=...
```

## Free deployment (about 15 minutes)

### 1. Supabase (database and login)
1. Create a free project at https://supabase.com.
2. Open **SQL Editor**, paste the contents of `supabase/migrations/20261015000000_init.sql`, and run it.
3. Open **Authentication → URL Configuration**:
   - set *Site URL* to your site, e.g. `https://neet-pathfinder.vercel.app`,
   - add the same URL under *Redirect URLs*.
4. Email sign-in links work out of the box. The free built-in mailer is rate-limited to a few emails per hour, which is fine for family use.
5. *(Optional)* Google sign-in. Create an OAuth client in Google Cloud Console (free). Use `https://<project>.supabase.co/auth/v1/callback` as the redirect URI, then paste the client id and secret into **Authentication → Providers → Google**.
6. Copy the **Project URL** and the **anon public key** from **Project Settings → API**.

### 2. Hosting (pick one; all are free)
- **Vercel**: import the GitHub repo. Add the environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then deploy. `vercel.json` already handles routing.
- **Netlify**: same steps. `netlify.toml` is included.
- **Cloudflare Pages**: build command `npm run build`, output folder `dist`. Add the same two variables.

### 3. Make yourself an admin (to publish shared questions)
Sign in once, then run this in the Supabase SQL Editor:

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'you@example.com';
```

### Free-tier notes
- Supabase pauses a free project after about a week with no activity. Daily use keeps it awake. If it does pause, click *Restore* in the dashboard; the data is kept.
- All the data for one student is a few MB, far below the 500 MB free database limit.

## How sync works
The app saves locally first, so it always works offline. When she is signed in, the whole progress document is mirrored to the `user_state` table. On a conflict the newest copy wins, and other open devices update live through Realtime. Row-level security means a student can only read and write her own data, and a guardian can only *read* data from students who invited that guardian's email.

## Project layout
```
src/data/          syllabus, weightage, built-in questions
src/engine/        pure, unit-tested logic: mastery/Elo, path planner, generators, tests, SRS, insights, search
src/cloud/         Supabase client, auth, API
src/store/         local-first store + cloud sync
src/pages/         screens (student + guardian)
supabase/          database schema with row-level security
```

The marks-to-rank curve in `src/engine/predict.ts` is an estimate based on recent years. Update it when new results are published.
