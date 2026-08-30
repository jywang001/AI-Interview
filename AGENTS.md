# Working agreement for coding agents

## Product contract

- The app must stay demonstrable in under three minutes.
- Keep API keys server-side and never commit `.env` files.
- Preserve `/api/health` and the offline demo path.
- Prefer one strong end-to-end workflow over many unfinished features.

## Before editing

1. Read `docs/HACKATHON_PLAYBOOK.md`.
2. Confirm the challenge statement, target user, and one measurable product promise.
3. Change `src/lib/app-config.ts` and `src/lib/system-prompt.ts` before expanding architecture.

## Verification

- Run `pnpm typecheck` after code changes.
- Run `pnpm build` before every deployment.
- Smoke-test desktop and mobile widths, the empty state, one success path, one error path, and `/api/health`.
- Do not mark a task complete without reporting what was actually tested.

## Scope discipline

- Do not add a database, authentication, queues, or multi-agent orchestration unless the challenge clearly requires it.
- Keep commits small and outcome-named: `feat:`, `fix:`, `test:`, `docs:`, `chore:`.
- Stop feature work early enough to record the final demo before the deadline.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
