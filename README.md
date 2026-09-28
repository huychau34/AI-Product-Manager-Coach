# AI PM Coach

A personalised AI product management learning app: assessment, roadmap, lessons with video, reading, practice, reflection, an AI Mentor chat and feedback.

## What's in this folder

| Path | What it is |
|---|---|
| `public/index.html` | The whole app (one page) |
| `netlify/functions/ai.mjs` | The AI backend for the Mentor chat and "New questions". Holds your Anthropic API key on the server. |
| `netlify.toml` | Tells Netlify where the page and the function are |

## One-time setup (about 15 minutes)

### 1. Get an Anthropic API key
1. Sign in at https://console.anthropic.com and add billing.
2. Create an API key and copy it. You'll only see it once.
3. Recommended: set a monthly spend limit in the Console so costs can never surprise you.

The app uses Claude Haiku 4.5 by default. One mentor reply typically costs well under one US cent.

### 2. Put the project on GitHub
1. Create a free account at https://github.com if you don't have one.
2. Click **New repository**, name it e.g. `ai-pm-coach`, choose **Private**, and create it.
3. On the empty repo page, click **uploading an existing file**.
4. Drag in the **contents** of this folder (`public`, `netlify`, `netlify.toml`, `README.md`) and click **Commit changes**.
   Check that `netlify/functions/ai.mjs` and `public/index.html` show up in the repo.

### 3. Connect the repo to Netlify
1. In Netlify, choose **Add new project → Import an existing project → GitHub**, and pick the repo.
2. Leave the build command empty. Netlify reads the rest from `netlify.toml`. Click **Deploy**.
3. Go to **Site configuration → Environment variables → Add a variable**:
   - Key: `ANTHROPIC_API_KEY`
   - Value: your key from step 1
4. Go to **Deploys → Trigger deploy → Deploy site**. Environment variables only apply to new deploys.

### 4. Turn on feedback collection
In Netlify, open **Forms** and enable **form detection**, then trigger one more deploy. Submissions appear under **Forms → feedback**. You can add email alerts under Forms notifications.

## Updating the app later
Upload the changed file to the same place in the GitHub repo (for example `public/index.html`) and commit. Netlify deploys automatically within a minute.

If you previously used Netlify Drop, that old site can be deleted. This GitHub-connected site replaces it.

## Optional settings
| Environment variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_MODEL` | `claude-haiku-4-5-20251001` | Use a different Claude model, e.g. a Sonnet model for richer answers at a higher cost |

## Safety built in
- The API key never reaches the browser.
- The server writes the prompts itself, so the endpoint can't be used as a free general-purpose chatbot.
- Each visitor is limited to 20 AI requests per minute. Extra requests get a friendly "please wait" message.
- Message length and chat history are capped.

## Troubleshooting (shown in the chat)
| Message | Fix |
|---|---|
| "isn't configured yet (no Anthropic API key)" | Add `ANTHROPIC_API_KEY` (step 3) and redeploy |
| "isn't set up on this site yet" | The function wasn't deployed. Make sure `netlify/functions/ai.mjs` and `netlify.toml` are in the repo |
| "a lot of messages in a short time" | The rate limit was hit, or your Anthropic account limit. Wait a minute |
| "works on the published website" | The file was opened directly. Use your Netlify URL |

Function logs, including any Anthropic API errors, are under **Logs → Functions → ai** in Netlify.
