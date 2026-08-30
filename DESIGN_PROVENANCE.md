# Design provenance

AI Interview is developed as an independent implementation. This register records where product decisions, prompts, copy, fixtures and visual assets came from so the public repository can be audited without relying on memory.

## Initial provenance register

| Artifact | Origin | Implementation record | Rights / boundary | Status |
| --- | --- | --- | --- | --- |
| Product definition and P0 scope | Product-owner requirements captured in `docs/PRD.md` | Independently structured for this repository on 2026-08-30 | No external product specification reused | Recorded |
| Prepare → Interview → Review → Drill flow | User requirements for materials, interviewer, coach and immediate retraining | Designed from the product jobs and four-stage learning loop in the PRD | Route names describe generic product actions; no third-party UI or flow copied | Recorded |
| Four-objective, five-turn interview contract | P0 time budget and acceptance criteria in the PRD | One background objective, one two-turn project objective, one role-technical objective and one applied-scenario objective | Original project data contract | Recorded |
| AI Interviewer, Material Analyst and Coach prompts | Responsibility and safety boundaries in the PRD | Authored specifically for this project with an OpenAI Codex coding assistant under product-owner direction | No external prompt text or hidden prompt corpus used | Recorded |
| Role competency profiles | Product-owner choice of AI algorithm and AI application development roles | Derived from generic job competencies and validated through future user tests | Must not import a proprietary or competitor question bank | Recorded |
| Product copy and page information architecture | Product promise and three-minute demo constraints in the PRD | Authored specifically for this repository | Must be reviewed again when the final brand name is chosen | Recorded |
| Offline Demo fixtures | Synthetic scenarios required by the PRD and evaluation plan | Original fictional AI application developer scenario authored for `src/fixtures/demo-session.ts` and validated against the live Schema on 2026-08-30 | Never present fixtures as live model output; do not include a real resume without permission | Recorded |
| Public Demo material set | Product-owner requirement for two role-specific, uploadable test bundles | The Markdown resumes, JDs and voice test under `fixtures/demo-materials/` were authored for this repository with an OpenAI Codex coding assistant on 2026-08-30; no reference file, real resume, external JD or competitor question bank was used | All people, institutions, employers, projects, metrics and experiences are fictional; the files contain no personal or confidential data and are cleared for public demo use | Verified 2026-08-30 |
| Public Demo resume PDFs | The fictional AI algorithm and AI application material set above | `output/pdf/ai-algorithm-resume-demo.pdf` and `output/pdf/ai-application-resume-demo.pdf` were generated on 2026-08-30 by `scripts/build_demo_resumes.py` with Python 3.12.13 and ReportLab 4.4.9, then checked with Poppler text extraction and full-page rendering | No reference asset or personal data used; the PDFs reference ReportLab's built-in `STSong-Light` CID mapping and do not embed a local font binary | Verified 2026-08-30 |
| Abstract Presenter placeholder | Original visual brief: calm, professional, non-photorealistic static interviewer | Hand-authored SVG geometry in `public/presenter-placeholder.svg` with an OpenAI Codex coding assistant; no reference image supplied | Project-original asset; no stock image, external character or competitor media incorporated | Recorded |
| Application dependencies | Engineering requirements of the local Next.js starter | Exact versions and licenses are recorded in `THIRD_PARTY.md` | Governed by their respective open-source licenses | Recorded |

## Competitive-research boundary

External interview products may be examined to understand the category, but they are not implementation sources. In particular, this project does not copy external code, prompts, question banks, data schemas, screen layouts, product copy, avatars, audio or other media. A familiar industry pattern is used only when it is generic and necessary, and the concrete implementation is derived from this repository's PRD.

If a future change intentionally adapts an external open-source implementation, it must be reviewed before use and recorded in both this file and `THIRD_PARTY.md`, including repository URL, commit, license, files affected and the nature of the modification.

## Fixture and generated-asset checklist

Before adding a fixture or generated asset, record:

- creator or generation tool;
- date and input brief;
- whether a reference file was used;
- whether the content contains personal or confidential data;
- license or permission basis;
- files in which it appears.

## Release audit

Before publishing:

1. Compare committed dependencies with `THIRD_PARTY.md`.
2. Check that every non-code asset appears in this register.
3. Confirm Demo resumes and JDs are fictional, desensitized or explicitly authorized.
4. Search for copied branding, competitor terminology and unrecorded question-bank content.
5. Confirm generated material is labeled where users could otherwise mistake it for live output.
6. Record the reviewer, date and release commit below.

| Release | Commit | Reviewer | Date | Result |
| --- | --- | --- | --- | --- |
| Initial scaffold | Pending | Pending | Pending | Pending |
| Public Demo materials audit | Pending | OpenAI Codex fixture/PDF QA | 2026-08-30 | Passed: synthetic content, no personal data, text extraction and full-page render verified; dependency and font mapping recorded |
