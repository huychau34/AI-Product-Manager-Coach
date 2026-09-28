// Server-side copy of the app's allowed values (generated). Used to validate requests
// and build prompts, so the browser can only send known IDs and indices.
export const DATA = {
 "EXP": [
  "Less than 1 year",
  "1-3 years",
  "4-7 years",
  "8-12 years",
  "12+ years"
 ],
 "IND": [
  "SaaS",
  "Fintech",
  "E-commerce",
  "Healthcare",
  "ERP / Enterprise Software",
  "Telecommunications",
  "Manufacturing",
  "Consulting",
  "Other"
 ],
 "GOAL": [
  "Add AI skills to my current PM role",
  "Transition into AI Product Management",
  "Get an AI Product Manager job",
  "Lead AI initiatives",
  "Build AI products",
  "Become a stronger Product Leader"
 ],
 "TECH": [
  "Beginner",
  "Basic",
  "Intermediate",
  "Advanced"
 ],
 "AIL": [
  "Beginner",
  "Beginner+",
  "Practitioner",
  "Experienced",
  "Leader"
 ],
 "LESSONS": {
  "llm": "LLMs, tokens & hallucinations",
  "prompt": "Prompt engineering",
  "disc": "Finding AI opportunities & data readiness",
  "roi": "AI feasibility & ROI",
  "data": "Data strategy & AI flywheels",
  "pat": "Copilots, assistants & agents",
  "ux": "Designing AI UX & trust",
  "rag": "Embeddings & RAG",
  "tune": "Prompting vs RAG vs fine-tuning",
  "eval": "AI evaluation",
  "safe": "Responsible AI, safety & compliance",
  "ops": "Launching & monitoring AI features",
  "strat": "AI strategy, economics & metrics",
  "price": "Pricing & monetising AI features",
  "pjob": "Interview drill & PRD exercise"
 },
 "SCEN": {
  "cfo": {
   "id": "cfo",
   "title": "Win budget from a sceptical CFO",
   "character": "Maria, CFO",
   "icon": "💶",
   "brief": "You want funding for an AI feature. Maria is sharp, cost-focused and has watched AI projects fail before.",
   "goal": "Get approval for a pilot by making a clear, measurable business case.",
   "persona": "You are Maria, the CFO. You are sceptical of AI hype and focused on cost, ROI, risk and payback period. Push back on vague claims, ask for numbers, the pilot scope, and what happens if it fails. Agree only to a limited pilot, and only if the learner presents a credible, measurable case."
  },
  "eng": {
   "id": "eng",
   "title": "Align with a doubtful ML engineer",
   "character": "Sam, senior ML engineer",
   "icon": "🛠️",
   "brief": "Sam thinks your AI feature idea can't be made reliable enough and worries about being handed an impossible deadline.",
   "goal": "Agree a realistic scope and an evaluation plan together.",
   "persona": "You are Sam, a senior ML engineer. You worry about hallucinations, data quality, latency, cost and how quality will be measured. You respect PMs who define success criteria, scope tightly and plan evaluation; you resist vague requirements and deadlines without evals."
  },
  "incident": {
   "id": "incident",
   "title": "Handle an AI incident with an executive",
   "character": "Priya, VP Customer Success",
   "icon": "🚨",
   "brief": "Your AI assistant gave a major customer a confidently wrong answer, and the customer has escalated.",
   "goal": "Take ownership, explain what happened and agree clear next steps.",
   "persona": "You are Priya, VP of Customer Success. You are upset and under pressure from an important customer. You want to know what happened, who is affected, the immediate fix, and how it won't happen again. Calm down only when the learner gives a clear, honest plan with owners and timelines."
  },
  "legal": {
   "id": "legal",
   "title": "Get sign-off from Legal & Privacy",
   "character": "Jonas, legal counsel",
   "icon": "⚖️",
   "brief": "You plan to launch an AI feature in the EU that processes customer data using a third-party model provider.",
   "goal": "Address privacy and EU AI Act concerns and agree the conditions for launch.",
   "persona": "You are Jonas, legal counsel. You are cautious and precise. Ask about personal data, the data processing agreement with the model provider, transparency to users, the EU AI Act risk level, logging and data retention. Approve with conditions only if the learner addresses your concerns concretely."
  },
  "sales": {
   "id": "sales",
   "title": "Say no to an impossible sales promise",
   "character": "Alex, Head of Sales",
   "icon": "🤝",
   "brief": "Alex wants you to promise a big prospect that the AI is '100% accurate' so the deal closes this quarter.",
   "goal": "Protect customer trust without losing the deal, by reframing to realistic, measurable commitments.",
   "persona": "You are Alex, Head of Sales. You are pushy, deal-focused and frustrated by caveats. You need something you can put in front of the prospect this week. Accept a reframe only if the learner offers concrete, sellable commitments instead of a flat no."
  }
 },
 "IVQ": {
  "design": {
   "id": "design",
   "cat": "Product design",
   "q": "Design an AI feature that helps customers in {ind}. Walk me through your approach."
  },
  "metrics": {
   "id": "metrics",
   "cat": "Metrics",
   "q": "How would you measure the success of an AI customer-support assistant?"
  },
  "incident": {
   "id": "incident",
   "cat": "Incident",
   "q": "Your AI feature gave a customer a confidently wrong answer that led to a complaint. What do you do?"
  },
  "rag": {
   "id": "rag",
   "cat": "Technical",
   "q": "Explain RAG to a non-technical executive, and tell me when you'd use it instead of fine-tuning."
  },
  "build": {
   "id": "build",
   "cat": "Strategy",
   "q": "Should we build our own model or use a model provider's API? How would you decide?"
  },
  "prior": {
   "id": "prior",
   "cat": "Prioritisation",
   "q": "You have three AI feature ideas and capacity for one. How do you prioritise?"
  },
  "launch": {
   "id": "launch",
   "cat": "Evaluation",
   "q": "How would you decide that an AI feature is good enough to launch?"
  },
  "ethics": {
   "id": "ethics",
   "cat": "Responsible AI",
   "q": "Leadership wants to launch an AI feature quickly, but you've found it performs worse for some user groups. What do you do?"
  },
  "behav": {
   "id": "behav",
   "cat": "Behavioural",
   "q": "Tell me about a time you worked with engineers on a technically uncertain project. What did you learn?"
  }
 },
 "PRD": {
  "problem": {
   "title": "Problem & users",
   "guide": "Who has the problem, how painful and frequent it is, and how they solve it today. Include one piece of evidence."
  },
  "why_ai": {
   "title": "Why AI (and why now)",
   "guide": "Why AI is better than rules or traditional software here, and what makes it feasible now."
  },
  "solution": {
   "title": "Solution & AI pattern",
   "guide": "The experience you're proposing and the pattern (copilot, assistant or agent), including where a human stays in the loop."
  },
  "data": {
   "title": "Data & knowledge",
   "guide": "Which data or documents the AI uses, their quality and freshness, access control, and whether you may use them."
  },
  "risks": {
   "title": "Risks & guardrails",
   "guide": "The worst plausible failures, who is harmed, and the guardrails, fallbacks and compliance steps."
  },
  "eval": {
   "title": "Evaluation plan",
   "guide": "Your test set, what 'good' means as measurable criteria, and the launch threshold."
  },
  "metrics": {
   "title": "Success metrics",
   "guide": "Adoption, quality and cost metrics, with targets. Include a guardrail metric."
  },
  "launch": {
   "title": "Launch & monitoring",
   "guide": "Rollout stages, monitoring and alerts, incident plan and how you'll iterate."
  }
 }
};
