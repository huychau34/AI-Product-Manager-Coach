// AI PM Coach - AI backend (Netlify Function)
//
// Powers the AI Mentor chat and the "New questions" button on the website.
// Your Anthropic API key stays here on the server; the browser never sees it.
//
// Settings (Netlify > Site configuration > Environment variables):
//   ANTHROPIC_API_KEY  required  your key from console.anthropic.com
//   ANTHROPIC_MODEL    optional  defaults to Claude Haiku 4.5 (fast and low cost)
//
// The page sends learner details (level, industry, lesson) and the chat turns.
// The prompts are built here, so the endpoint can't be used as a general-purpose
// proxy for your API key. Requests are also rate limited per visitor (see config).

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
const API_URL = "https://api.anthropic.com/v1/messages";

const clip = (v, n) => String(v ?? "").slice(0, n);
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

// Keep these two prompts in sync with mentorSys() / questionsPrompt() in public/index.html
function mentorSystem(i) {
  return `You are an AI Product Management coach. Learner: ${i.exp} PM in ${i.ind}; technical level ${i.tech}; AI experience ${i.ai}; goal: ${i.goal}. Current lesson: ${i.lesson}. Completed lessons: ${i.done.join(", ") || "none"}. Keep replies under 150 words, PM-focused, use ${i.ind} examples, give feedback on the learner's explanation, then ask ONE follow-up question. Don't just give all answers.`;
}
function questionsPrompt(i, seen) {
  return `Write 4 NEW multiple-choice practice questions for a Product Manager learning "${i.lesson}" (AI product management). Learner: ${i.exp} PM in ${i.ind}, technical level ${i.tech}, AI experience ${i.ai}. Use ${i.ind} scenarios. Rules: exactly 1 question is select-all-that-apply with 2 or 3 correct options; the other 3 have exactly 1 correct option. Each has 4 options, and the correct answers must not always be first. Each has a short explanation (max 30 words). Do NOT repeat or paraphrase any of these earlier questions: ${JSON.stringify(seen)}. Return ONLY a JSON array like [{"q":"...","o":["a","b","c","d"],"c":[1],"e":"..."}].`;
}

function cleanInfo(raw) {
  const i = raw && typeof raw === "object" ? raw : {};
  return {
    exp: clip(i.exp, 40),
    ind: clip(i.ind, 60),
    tech: clip(i.tech, 40),
    ai: clip(i.ai, 40),
    goal: clip(i.goal, 80),
    lesson: clip(i.lesson, 120),
    done: (Array.isArray(i.done) ? i.done : []).slice(0, 20).map((x) => clip(x, 120)),
  };
}

// The Messages API needs turns that start with "user" and alternate roles.
function cleanMessages(raw) {
  const out = [];
  for (const m of (Array.isArray(raw) ? raw : []).slice(-20)) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") continue;
    const content = clip(m.content, 4000).trim();
    if (!content) continue;
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += "\n\n" + content;
    else out.push({ role: m.role, content });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

// Calls Claude with streaming on, and turns the event stream into plain text chunks.
async function streamClaude(key, body) {
  const upstream = await fetch(API_URL, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, stream: true, ...body }),
  });
  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    console.error("Anthropic API error", upstream.status, detail.slice(0, 500));
    return json({ error: upstream.status === 429 ? "rate_limited" : "upstream_error" }, upstream.status === 429 ? 429 : 502);
  }
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body.getReader();
      let buf = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let k;
          while ((k = buf.indexOf("\n\n")) >= 0) {
            const event = buf.slice(0, k);
            buf = buf.slice(k + 2);
            const line = event.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            try {
              const d = JSON.parse(line.slice(5));
              if (d.type === "content_block_delta" && d.delta && d.delta.type === "text_delta") {
                controller.enqueue(enc.encode(d.delta.text));
              } else if (d.type === "error") {
                console.error("Anthropic stream error", JSON.stringify(d).slice(0, 500));
              }
            } catch {
              /* ignore keep-alive or partial lines */
            }
          }
        }
      } catch (e) {
        console.error("Stream interrupted", e);
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return json({ error: "missing_api_key" }, 500);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  const info = cleanInfo(body.info);

  if (body.mode === "mentor") {
    const messages = cleanMessages(body.messages);
    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return json({ error: "bad_messages" }, 400);
    }
    return streamClaude(key, { max_tokens: 600, system: mentorSystem(info), messages });
  }

  if (body.mode === "questions") {
    const seen = (Array.isArray(body.seen) ? body.seen : []).slice(-40).map((q) => clip(q, 300));
    return streamClaude(key, {
      max_tokens: 2500,
      messages: [{ role: "user", content: questionsPrompt(info, seen) }],
    });
  }

  return json({ error: "bad_mode" }, 400);
};

export const config = {
  path: "/api/ai",
  // Each visitor can make up to 20 AI requests per minute; extra requests get HTTP 429.
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
