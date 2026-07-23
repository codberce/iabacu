# Archive maintenance

This guide is for maintainers changing the document catalog. It is not needed
to run iabacu locally.

## Policy

Prefer official Ministry archives. Older papers may use a vetted mirror when
the manifest keeps the source URL and checksum. Only redistribute material
that can legally be shared.

## Bac and Evaluarea Națională

```bash
pnpm import:all-exams
pnpm validate:exams
```

Importers place PDFs in `public/exams` and extracted text in
`src/data/exam-text`.

## Olympiads

```bash
pnpm import:olympiad
pnpm validate:olympiad
pnpm check:olympiad-index
```

The generated indexes under `src/data` map every document to its SHA-256. The
offline asset release stores those files as:

```text
public/olympiad/pdf/<sha256>.pdf
public/olympiad/text/<sha256>.txt
```

## Before publishing

```bash
pnpm lint
pnpm test
pnpm validate:exams
pnpm validate:olympiad
pnpm check:olympiad-index
pnpm audit:archives
pnpm check:links:internal
pnpm build
pnpm assets:verify
```

When documents change, publish a new offline asset release, update the version,
file sizes, and checksums in `scripts/offline-assets.json`, and test both a clean
installation and an interrupted download. The installer reads this manifest,
resumes partial files, and records each extracted archive separately.
