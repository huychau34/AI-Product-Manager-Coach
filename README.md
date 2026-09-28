# AI PM Coach

A personalised AI product management learning app: assessment, roadmap, 15 lessons (video, reading, practice, reflection with AI feedback, AI Mentor), a daily challenge, smart review, role-play and interview simulators, a capstone AI PRD, achievements and a LinkedIn-ready certificate.

## What's in this folder

| Path | What it is |
|---|---|
| `public/index.html` | The page shell (menus, footer, feedback form) |
| `public/js/app.js` | All app logic |
| `public/js/content.js` | Lessons, questions, readings, videos, simulator scenarios, interview questions and capstone sections |
| `public/js/config.js` | Your settings: site address, analytics key, About-page details |
| `public/css/app.css` | Styles |
| `public/learn/` | Search-friendly topic pages, one per lesson |
| `public/sitemap.xml`, `public/robots.txt`, `public/og.png`, `public/favicon.svg` | Search engines, link previews and icon |
| `netlify/functions/ai.mjs` | The AI backend for every AI feature. Holds your Anthropic API key on the server. |
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

## Turning on analytics (PostHog)

1. Create a free PostHog account and choose **EU Cloud**.
2. Copy your **project API key** (starts with `phc_`).
3. In `public/js/config.js`, paste it into `posthogKey: ""` and commit.

Visitors see a consent banner and nothing is tracked until they click **Allow**. Events include assessment started/completed, lessons opened/completed, practice answers, mentor messages, reflections, reviews, daily challenges, simulator scores, PRD reviews, achievements and certificate actions, which is enough to build activation, funnel and retention charts in PostHog. If you use another analytics tool, its domain must also be added to the Content-Security-Policy in `netlify.toml`.

## Settings

| Environment variable (Netlify) | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | - | Required. Your Anthropic key |
| `ANTHROPIC_MODEL` | `claude-haiku-4-5-20251001` | Use a different Claude model |
| `DAILY_LIMIT_PER_VISITOR` | `150` | AI requests per visitor per day |
| `DAILY_LIMIT_TOTAL` | `3000` | AI requests for the whole site per day |
| `ALLOWED_ORIGINS` | - | Extra site addresses allowed to call the AI (e.g. a custom domain before DNS is final) |

`public/js/config.js` holds the site address (used by the certificate and LinkedIn buttons), the PostHog key and the About-page details. If you move to a custom domain, update `siteUrl` there and the addresses in `public/index.html`, `public/sitemap.xml` and `public/robots.txt`.

## Safety built in

- The API key never reaches the browser.
- AI requests must come from your own site (Origin check); others get "forbidden".
- The browser only sends known answer numbers and IDs; the server builds every prompt, so the endpoint can't be used as a free general-purpose chatbot, and the mentor stays on topic.
- Limits: 20 AI requests per minute per visitor, plus daily caps per visitor and for the whole site (stored in Netlify Blobs; if Blobs is unavailable, only the per-minute limit applies).
- Security headers: Content-Security-Policy (only your site, YouTube's privacy-enhanced player and PostHog EU are allowed), no framing, no sniffing, strict referrer policy.
- All AI output and user text is escaped before it's shown.
- A privacy notice (footer → Privacy) explains what is stored where. Have it reviewed if you're unsure it fits your situation.

## Editing content

- Lesson text, questions, readings and videos: `public/js/content.js`.
- If you **add or rename a lesson, scenario, interview question or PRD section**, add the same ID and title to `netlify/lib/content.mjs` too, so the server accepts it.
- Topic pages in `public/learn/` are static copies of the lesson text; update them when you change a lesson significantly.

## Admin page

Hidden from the menus. Open `https://<your-site>/admin` (or `/administrator`). It shows counts for the browser you open it in only; use PostHog for real cross-user numbers.

## Troubleshooting (messages shown in the app)

| Message | Fix |
|---|---|
| "no Anthropic API key" | Add `ANTHROPIC_API_KEY` and redeploy |
| "API key rejected" | Update the key in Netlify, redeploy |
| "out of credit" | Add credit in the Anthropic Console |
| "isn't set up on this site yet" | `netlify/functions/ai.mjs` or `netlify.toml` is missing from the repo |
| "blocked because it didn't come from this site" | You're using a new domain: add it to `ALLOWED_ORIGINS` or update the site address |
| "today's limit" | The daily cap was reached; raise `DAILY_LIMIT_PER_VISITOR` / `DAILY_LIMIT_TOTAL` if needed |

Function logs, including Anthropic API errors, are under **Logs → Functions → ai** in Netlify.
