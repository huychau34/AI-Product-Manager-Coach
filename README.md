# AI PM Coach

A personalised AI product management learning app: a 5-question assessment, a learning plan, 15 lessons (video, reading, practice, reflection with AI feedback), a coach that floats on every page, a daily question, smart review, role-play and interview simulators, a capstone AI PRD and achievements. Learners can sign in with Google to keep their progress in the cloud, and you get an admin dashboard of sign-ins and active users.

## What's in this folder

| Path | What it is |
|---|---|
| `public/index.html` | The page shell (menus, footer, feedback form) |
| `public/js/app.js` | All app logic |
| `public/js/content.js` | Lessons, questions, readings, videos, simulator scenarios, interview questions and capstone sections |
| `public/js/config.js` | Your settings: site address, analytics key, About-page details |
| `public/fonts/` | The Hanken Grotesk font, self-hosted (SIL Open Font License, licence file included) |
| `public/css/app.css` | Styles |
| `public/learn/` | Search-friendly topic pages, one per lesson |
| `public/sitemap.xml`, `public/robots.txt`, `public/og.png`, `public/favicon.svg` | Search engines, link previews and icon |
| `netlify/functions/ai.mjs` | The AI backend for every AI feature. Holds your Anthropic API key on the server. |
| `netlify/functions/account.mjs` | Accounts: Google sign-in, cloud progress, sign-in tracking and the admin dashboard data |
| `supabase/setup.sql` | Creates the database tables in Supabase (run once) |
| `netlify/lib/content.mjs` | The server's list of allowed values (lesson titles, scenarios, interview questions) |
| `netlify.toml` | Netlify settings: folders, the hidden admin address and security headers |
| `package.json` | Tells Netlify to install `@netlify/blobs`, used for daily AI limits |

## Updating the site from this version

This version replaces the single `index.html` with several files and folders. In GitHub:

1. Delete any stray copies at the top level of the repo, such as `index (1).html` or `ai.mjs` (open the file, then **⋯ → Delete file**). Files inside `public` and `netlify` will simply be replaced by the upload.
2. Open **Add file → Upload files** on the repo's main page and drag in **everything inside this folder** (`public`, `netlify`, `netlify.toml`, `package.json`, `README.md`) using Chrome, Edge or Firefox so the folders keep their structure. Existing files with the same name are replaced.
3. Commit. Netlify deploys automatically. The first deploy takes a little longer because it installs the package.
4. Check the repo shows `public/js/app.js`, `public/learn/rag.html`, `netlify/lib/content.mjs` and `netlify/functions/ai.mjs`.

Your existing learners keep their progress: the new version upgrades their saved data and adds the new lessons to their roadmap.

## One-time setup (if you're starting fresh)

1. **Anthropic API key:** create one at https://console.anthropic.com, add billing, and **set a monthly spend limit**.
2. **Netlify:** import the GitHub repo (no build command needed). Under **Project configuration → Environment variables**, add `ANTHROPIC_API_KEY` with **Contains secret values** ticked; paste the key into the **Production** value. Then **Deploys → Trigger deploy**.
3. **Feedback form:** in Netlify **Forms**, enable form detection, then trigger a deploy. Submissions appear under **Forms → feedback**.

## Accounts: Google sign-in and cloud progress (about 30 minutes, once)

Until this is set up, the app works exactly as before (progress in the browser) and the "Sign in" button stays hidden. You'll use two free services: **Supabase** (accounts and database) and **Google Cloud** (the "Sign in with Google" button).

**1. Create the Supabase project**
1. Sign up at https://supabase.com and create a new project. Choose an **EU region** (for example Frankfurt or Stockholm) and save the database password somewhere safe.
2. Open **SQL Editor → New query**, paste the whole of `supabase/setup.sql`, and click **Run**. It should say "Success".
3. Open **Project Settings → API Keys** (or **Data API**) and note three values: the **Project URL** (`https://xxxx.supabase.co`), the **anon / publishable** key, and the **service_role / secret** key. Keep the secret key private.

**2. Create the Google sign-in client**
1. Go to https://console.cloud.google.com, create a project (e.g. "AI PM Coach").
2. **APIs & Services → OAuth consent screen**: choose **External**, enter the app name "AI PM Coach", your support email, and add the authorised domains `netlify.app` and `supabase.co`. Scopes: keep the defaults (email, profile, openid).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** → **Web application**.
   - Authorised JavaScript origins: `https://aipmcoach.netlify.app`
   - Authorised redirect URIs: `https://xxxx.supabase.co/auth/v1/callback` (your Supabase Project URL + `/auth/v1/callback`)
   Copy the **Client ID** and **Client secret**.
4. Back on the **OAuth consent screen** (or **Audience**) page, click **Publish app** so anyone can sign in, not just test users. Basic scopes don't need Google's review.

**3. Connect Google to Supabase**
1. In Supabase, **Authentication → Sign In / Providers → Google**: switch it on, paste the Client ID and Client secret, and save.
2. **Authentication → URL Configuration**: set **Site URL** to `https://aipmcoach.netlify.app` and add `https://aipmcoach.netlify.app/**` under **Redirect URLs**.

**4. Add the settings to Netlify**
Under **Project configuration → Environment variables**, add (tick **Contains secret values** for the keys and fill the **Production** value):

| Key | Value |
|---|---|
| `SUPABASE_URL` | your Project URL |
| `SUPABASE_ANON_KEY` | the anon / publishable key |
| `SUPABASE_SERVICE_KEY` | the service_role / secret key |
| `ADMIN_EMAILS` | the Google email(s) allowed to see the dashboard, comma-separated |

Then **Deploys → Trigger deploy → Deploy site**.

**5. Test it:** open the site, click **Sign in → Continue with Google**, and you should come back signed in (your name appears top right). Then open `/admin`.

How it works for learners: visitors who aren't signed in always start at the visitor page. They can take the 5-question assessment and see their plan, but that plan is kept only for the visit (in the browser tab's session storage) and disappears when they close the tab. **Lessons and all AI features** (the coach, reflection feedback, new AI questions, role-play, interview and PRD review) need a free Google sign-in. The server enforces this: once accounts are set up, any AI request without a valid sign-in is refused with "login_required" before it reaches Anthropic, so guests can't spend your tokens. If accounts aren't set up, the app works for everyone and saves in the browser as before. Progress a guest saved in this browser under the old version is kept aside and added to their account the first time they sign in. On a new device, account progress loads automatically; if a browser and the account both have different progress, the learner chooses which to keep. Changes save automatically about two seconds after each edit, and progress made on two devices is merged.

### The learner experience

- **Today** (home): the next lesson, a coach card that asks how much time you have (20 minutes opens the lesson, 5 minutes shows the daily question right there), this week's goal, review, practice and capstone. First-time visitors get a short guided tour (shown once).
- **Lessons**: a narrator bar at the top shows minutes left and the next step, a "Key idea" note sits next to "Why it matters", and a "Does that make sense?" checkpoint after the explanation lets learners ask the coach to explain it another way. Finishing a lesson shows a short completion moment with the plan's progress, the next lesson and the week's goal.
- **Coach**: the round button in the bottom-right corner opens a chat on every page. Inside a lesson it uses that lesson's chat; elsewhere it has a general chat and knows which page the learner is on.
- **What's next**: when the plan is finished, Today suggests adding more lessons (listed at the bottom of the Plan page with "Add to my plan"), the capstone, the practice studio and daily review. There is no certificate any more.
- **Assessment**: 5 questions (experience, technical comfort, AI experience, goal, time per week). Industry is optional and set under "My product" on Today or the profile page.

## Turning on analytics (PostHog)

1. Create a free PostHog account and choose **EU Cloud**.
2. Copy your **project API key** (starts with `phc_`).
3. In `public/js/config.js`, paste it into `posthogKey: ""` and commit.

Visitors see a consent banner and nothing is tracked until they click **Allow**. Events include assessment started/completed, lessons opened/completed, practice answers, mentor messages, reflections, reviews, daily challenges, simulator scores, PRD reviews, coach chats and achievements, which is enough to build activation, funnel and retention charts in PostHog. If you use another analytics tool, its domain must also be added to the Content-Security-Policy in `netlify.toml`.

## Settings

| Environment variable (Netlify) | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | - | Required. Your Anthropic key |
| `ANTHROPIC_MODEL` | `claude-haiku-4-5-20251001` | Use a different Claude model |
| `DAILY_LIMIT_PER_USER` | `50` | AI requests per signed-in learner per day (counted per account, so new browsers or cleared cookies don't reset it) |
| `DAILY_LIMIT_PER_VISITOR` | `150` | AI requests per visitor per day, only used if accounts aren't set up |
| `DAILY_LIMIT_TOTAL` | `3000` | AI requests for the whole site per day |
| `ALLOWED_ORIGINS` | - | Extra site addresses allowed to call the AI and account functions (e.g. a custom domain before DNS is final) |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` | - | Turn on accounts (see above) |
| `ADMIN_EMAILS` | - | Who can see the admin dashboard |
| `STATS_TIMEZONE` | `Europe/Helsinki` | Which timezone "today" means in the dashboard |

`public/js/config.js` holds the site address, the PostHog key and the About-page details. If you move to a custom domain, update `siteUrl` there and the addresses in `public/index.html`, `public/sitemap.xml` and `public/robots.txt`.

## Safety built in

- The API key never reaches the browser.
- AI requests must come from your own site (Origin check); others get "forbidden".
- The browser only sends known answer numbers and IDs; the server builds every prompt, so the endpoint can't be used as a free general-purpose chatbot, and the mentor stays on topic.
- Accounts: the database is locked (row level security with no public access); only the account function, using the secret key, reads or writes it. Every request checks the learner's Google sign-in token with Supabase, so learners can only reach their own progress, and only emails in `ADMIN_EMAILS` see the dashboard. Learners can delete their account and all its data from the Account page.
- Sign-in for AI: when accounts are set up, every AI request must carry a valid Google sign-in token, checked with Supabase on the server.
- Limits: 20 AI requests per minute per visitor, plus daily caps per account (or per visitor when accounts are off) and for the whole site (stored in Netlify Blobs; if Blobs is unavailable, only the per-minute limit applies).
- Security headers: Content-Security-Policy (only your site, YouTube's privacy-enhanced player and PostHog EU are allowed), no framing, no sniffing, strict referrer policy.
- All AI output and user text is escaped before it's shown.
- A privacy notice (footer → Privacy) explains what is stored where. Have it reviewed if you're unsure it fits your situation.

## Editing content

- Lesson text, questions, readings and videos: `public/js/content.js`.
- Each lesson has about 5 videos, written as `["YouTube ID", "title", "channel", "short note", level]`, where level is 1 = intro, 2 = standard, 3 = deep dive. The app picks the video that matches the learner's depth (Skim, Standard or Deep dive), prefers videos they haven't watched, and skips ones they rated 👎. After a lesson is completed, a revisit shows a different video. Learners can also tap **Show me a different video** or pick from the full list. Ratings from signed-in learners appear on the admin page under **Video ratings**; replace videos that collect many 👎.
- If you **add or rename a lesson, scenario, interview question or PRD section**, add the same ID and title to `netlify/lib/content.mjs` too, so the server accepts it.
- Topic pages in `public/learn/` are static copies of the lesson text; update them when you change a lesson significantly.

## Admin dashboard

Hidden from the menus. Open `https://<your-site>/admin` (or `/administrator`) and sign in with a Google account listed in `ADMIN_EMAILS`. It shows:

- sign-ins today, active users today, new sign-ups today, active users in the last 7 and 30 days, and total accounts
- a chart of active users and sign-ins for the last 14 days (hover a day for exact numbers, or open it as a table)
- every learner with their join date, last activity, active days in the last 30 days and lessons completed
- video ratings: 👍 and 👎 per lesson video

"Active" means a signed-in learner opened the app that day; "sign-ins" counts each time someone signed in with Google. Guests without an account aren't included; add PostHog for those. The raw data is in Supabase (**Table Editor → activity**) if you want to export it.

## Troubleshooting (messages shown in the app)

| Message | Fix |
|---|---|
| "no Anthropic API key" | Add `ANTHROPIC_API_KEY` and redeploy |
| "API key rejected" | Update the key in Netlify, redeploy |
| "out of credit" | Add credit in the Anthropic Console |
| "isn't set up on this site yet" | `netlify/functions/ai.mjs` or `netlify.toml` is missing from the repo |
| "blocked because it didn't come from this site" | You're using a new domain: add it to `ALLOWED_ORIGINS` or update the site address |
| "Sign in" button missing | Accounts aren't configured: check the four Supabase/admin variables and redeploy |
| Google says "access blocked" or "redirect_uri_mismatch" | The redirect URI in Google Cloud must be exactly `https://xxxx.supabase.co/auth/v1/callback`, and the app must be published |
| You return to the site but aren't signed in | Add your site to Supabase **Authentication → URL Configuration** (Site URL and Redirect URLs) |
| Admin page says "isn't an admin account" | Add that email to `ADMIN_EMAILS` and redeploy |
| "today's limit" | The daily cap was reached; raise `DAILY_LIMIT_PER_USER` / `DAILY_LIMIT_TOTAL` if needed |
| "Sign in with Google to use the AI coach" for a signed-in learner | Their session expired and couldn't be refreshed; signing out and in again fixes it |

Function logs are under **Logs → Functions** in Netlify: `ai` for AI errors and `account` for sign-in and database errors. Netlify's free plan allows two rate-limit rules per site; this app uses both (AI and accounts).
