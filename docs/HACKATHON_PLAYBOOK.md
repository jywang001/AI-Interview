# AIIC hackathon playbook

## Non-negotiable deliverables

- Public GitHub repository with visible commit history.
- Publicly reachable application URL.
- The two organizer-provided SSH public keys installed on the deployment user.
- Final build and deployment completed before the stated deadline.
- Demo video no longer than three minutes, explaining the idea and showing the product.
- Keep invoices or screenshots for eligible tool costs; reimbursement cap is RMB 150.

## The first 45 minutes after the prompt drops

1. Rewrite the task as: **For [specific user], when [painful moment], this app [single outcome], unlike [current workaround].**
2. Define one golden demo: a realistic input, the visible AI transformation, and a result the user can act on.
3. Write three acceptance checks. If they cannot be demonstrated, cut the feature.
4. Update `app-config.ts`, `system-prompt.ts`, the README title, and the example prompts.
5. Commit `docs: define challenge scope and golden demo` before implementation.

## Suggested build clock

| Window | Goal | Exit condition |
| --- | --- | --- |
| 0:00-0:45 | Scope | One user, one promise, one golden demo |
| 0:45-2:30 | Vertical slice | Real input reaches model and returns useful output |
| 2:30-4:30 | Differentiator | One memorable capability, fully integrated |
| 4:30-5:30 | Reliability | Empty/error/loading states and input limits work |
| 5:30-6:15 | Deployment | Public URL and `/api/health` pass from another network |
| 6:15-7:00 | Polish | Mobile layout, copy, example data, latency |
| 7:00-7:30 | Freeze | Final build, deploy, commit SHA, URL recorded |
| 7:30-end | Demo | Record, verify audio/video, prepare submission |

Adjust the clock to the actual competition duration. Freeze at least 30 minutes before the deadline.

## Golden-path evaluation set

Create `evals/cases.json` as soon as the challenge is known. Include:

- 3 normal user requests;
- 2 ambiguous or incomplete requests;
- 1 very long/noisy request;
- 1 unsafe or out-of-scope request;
- expected characteristics, not exact prose.

Rerun the same cases after prompt/model/tool changes. Judge correctness, usefulness, latency, and whether claims are grounded.

## Deployment freeze evidence

Immediately after the final deployment, record:

```sh
git rev-parse HEAD
git log -1 --format='%H %cI %s'
curl -fsS https://YOUR_HOST/api/health
docker compose ps
```

Save the output locally and take a timestamped screenshot. Do not rebuild after the deadline.

## Three-minute demo structure

- 0:00-0:20 — the user and painful moment.
- 0:20-0:40 — the product promise and why existing workflow is poor.
- 0:40-2:10 — one uninterrupted golden-path demo with realistic data.
- 2:10-2:35 — one differentiator and one reliability detail.
- 2:35-2:55 — impact, architecture in one sentence, public URL/GitHub.
- 2:55-3:00 — closing line.

Record a backup take before making last-minute cosmetic changes.
