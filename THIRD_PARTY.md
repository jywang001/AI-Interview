# Third-party software register

This file records third-party software intentionally included in AI Interview. Versions are pinned in `package.json` and resolved by `pnpm-lock.yaml`. License labels below come from the installed package metadata and must be rechecked whenever a dependency is added or upgraded.

## Runtime dependencies

| Package | Version | License | Purpose | Upstream |
| --- | ---: | --- | --- | --- |
| Next.js (`next`) | 16.3.3 | MIT | App Router, route handlers, production build and standalone server | https://nextjs.org |
| React (`react`) | 19.2.8 | MIT | User interface rendering | https://react.dev |
| React DOM (`react-dom`) | 19.2.8 | MIT | Browser DOM integration | https://react.dev |
| AI SDK (`ai`) | 7.0.83 | Apache-2.0 | Server-side model calls and structured generation | https://ai-sdk.dev |
| OpenAI provider (`@ai-sdk/openai`) | 4.0.50 | Apache-2.0 | Adapter for OpenAI-compatible model endpoints | https://ai-sdk.dev |
| Zod (`zod`) | 4.4.3 | MIT | Runtime validation for requests, responses, state and fixtures | https://zod.dev |

## Development dependencies

| Package | Version | License | Purpose | Upstream |
| --- | ---: | --- | --- | --- |
| TypeScript (`typescript`) | 7.0.2 | Apache-2.0 | Static type checking and compilation | https://www.typescriptlang.org |
| Node.js types (`@types/node`) | 26.4.0 | MIT | Node.js TypeScript declarations | https://github.com/DefinitelyTyped/DefinitelyTyped |
| React types (`@types/react`) | 19.2.18 | MIT | React TypeScript declarations | https://github.com/DefinitelyTyped/DefinitelyTyped |
| React DOM types (`@types/react-dom`) | 19.2.5 | MIT | React DOM TypeScript declarations | https://github.com/DefinitelyTyped/DefinitelyTyped |
| Vitest (`vitest`) | 3.2.4 | MIT | Offline unit/API tests and opt-in live-model behavior evaluations | https://vitest.dev |

## System and fixture-generation tools

These tools are intentionally outside the Node dependency graph. `poppler-utils` is installed in the Docker builder and runner; Python and ReportLab are needed only when a developer regenerates the committed demo PDFs and are not installed in the production image.

| Tool | Version / source | License | Purpose | Upstream |
| --- | --- | --- | --- | --- |
| Poppler utilities and mapping data (`pdftotext`, `poppler-data`) | Alpine `poppler-utils` and `poppler-data`; exact package versions resolved during image build | GPL-2.0-or-later and BSD-style mapping-data notices, with component notices upstream | Extract text from user-supplied text PDFs, including Chinese CID-font mappings; `pdfinfo`, `pdffonts` and `pdftoppm` were also used for release QA | https://poppler.freedesktop.org |
| Python | 3.12.13 for the 2026-08-30 fixture build; developer-only | PSF-2.0 | Run the fixture PDF generation script | https://www.python.org |
| ReportLab | 4.4.9 for the 2026-08-30 fixture build; developer-only | BSD-3-Clause | Generate the two fictional resume PDFs | https://www.reportlab.com/opensource |

## Assets and hosted services

- `public/presenter-placeholder.svg` is an original project asset; it does not incorporate a third-party image, icon set or character design.
- The two PDFs in `output/pdf/` reference the standard `STSong-Light` CID font mapping supplied by ReportLab and the PDF core font Helvetica. `pdffonts` reports both as non-embedded, so no local or proprietary font binary is redistributed in these artifacts.
- No stock media, external question bank or competitor asset is included in the initial scaffold.
- Model and speech services are deployment choices, not redistributed software. Before a public deployment, record the selected provider, applicable terms, processing region and retention policy here or in a linked operations document.

## Review procedure

For every new dependency or asset:

1. Record its exact package or asset name, version/source, license and purpose.
2. Verify that redistribution and intended use are permitted.
3. Retain required copyright and license notices.
4. Remove unused packages before release.
5. Reconcile this register with `pnpm-lock.yaml` during the release audit.

This register is informational and is not a substitute for legal review.
