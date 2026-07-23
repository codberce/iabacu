# Contributing to iabacu

Thank you for helping improve iabacu. Contributions can include code, tests,
accessibility improvements, documentation, source corrections, and verified
archive metadata.

## Before you start

- Search existing issues and pull requests to avoid duplicate work.
- Open an issue before a large architectural change or a bulk data import.
- Do not disclose security vulnerabilities in a public issue; follow
  [SECURITY.md](SECURITY.md).
- Only contribute material that you have the right to share. Archive additions
  must include a stable source URL and provenance information.

By contributing, you agree that your original contributions are licensed under
the MIT License. Third-party educational material remains subject to its
original terms, as explained in [THIRD_PARTY_CONTENT.md](THIRD_PARTY_CONTENT.md).

## Development setup

Install Node.js 22 or newer, then run:

```bash
npx --yes pnpm@11.3.0 install --frozen-lockfile
cp .env.example .env.local
npx --yes pnpm@11.3.0 dev
```

No credentials are required to run the site. Environment variables are needed
only for the optional AI provider. Never commit an environment file,
credential, production export, or user data.

Important areas of the repository:

- `src/app`: pages and API routes.
- `src/components`: user-interface components and their tests.
- `src/lib`: local persistence, AI helpers, archive helpers, and shared logic.
- `src/data`: provenance manifests, generated indexes, and extracted text.
- `scripts`: import, migration, validation, and archive-health tools.
- `public/exams`: locally served Bac PDFs.

## Making changes

Keep changes focused and add tests for behavior changes. Follow the existing
TypeScript and React style; ESLint is the source of truth for formatting and
code quality.

For archive changes:

1. Confirm that the source is official or otherwise permitted by the archive
   policy.
2. Preserve the source URL, document role, and SHA-256 checksum.
3. Do not hand-edit generated indexes when a build script owns them.
4. Do not commit `tmp/`, `.cache/`, downloaded source archives, or generated
   audit reports.
5. Review [docs/ARCHIVE_MAINTENANCE.md](docs/ARCHIVE_MAINTENANCE.md) before
   running an import or publishing assets.

## Verification

Run the checks relevant to your change. Before requesting review, the expected
baseline is:

```bash
pnpm lint
pnpm test
pnpm validate:exams
pnpm validate:olympiad
pnpm check:olympiad-index
pnpm check:links:internal
pnpm build
```

The same checks run in GitHub Actions. Import commands may access the original
document sources and are not required for ordinary code contributions.

## Pull requests

Describe the user-visible result, link related issues, and note any data or
configuration changes. Include screenshots for visual changes and explain what
you tested. A maintainer may ask for a smaller scope or additional provenance
before merging.
