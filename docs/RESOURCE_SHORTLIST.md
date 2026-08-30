# Mature AI app resources

Use the smallest layer that solves the announced problem. More orchestration is not automatically a better demo.

## Recommended default for this starter

- **Vercel AI SDK** — provider-agnostic TypeScript generation, tools, structured output, and chat UI primitives. Its repository also publishes an installable coding-agent skill.
- **Vercel Chatbot** — reference implementation for auth, persistence, attachments, and a polished Next.js AI UI. Borrow patterns selectively; the full template has more infrastructure than most short hackathons need.

## Add only when the prompt requires it

- **OpenAI Agents SDK** — good when the product truly needs managed tool loops, handoffs, sessions, guardrails, tracing, voice, or sandboxed workspaces. Direct Responses API is simpler for a short single-agent flow.
- **LangGraph** — good for durable, stateful, resumable workflows and explicit human-in-the-loop graphs. Avoid for a one-shot assistant.
- **assistant-ui** — mature React primitives for a polished chat interface when custom tool-call rendering is central to the demo.

## Useful coding-agent skills

- `npx skills add vercel/ai` — current AI SDK APIs and common-error guidance.
- `npx skills add vercel-labs/agent-skills` — Vercel's official collection; select only relevant skills.
- `npx skills add vercel-labs/agent-browser` — browser-based smoke tests and demo-flow automation.

Inspect any skill before installing it. Commit project-scoped skills only when their instructions are useful to every collaborator.
