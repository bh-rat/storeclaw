# StoreClaw

**StoreClaw** is an attempt to build an agentic AI assistant for micro enterprises especially retail and ecommerce businesses through natural conversation.

## Codebase Origin

This repo is forked from [OpenClaw](https://github.com/openclaw/openclaw). The vast majority of source code, configs, paths, CLI references, and documentation still use "OpenClaw" / `openclaw` naming. This is expected — renaming is happening incrementally.

**What this means for you as a coding agent:**

- You will see `openclaw` everywhere — in imports, CLI commands, config paths (`~/.openclaw/`), package names, docs URLs (`docs.openclaw.ai`), etc. This is the inherited codebase, not a bug.
- **All new code, comments, docs, and user-facing text you write must use "StoreClaw" / `storeclaw`.**
- Do not propagate `openclaw` naming into new work. When modifying existing files, use `storeclaw` for any new additions but do not bulk-rename existing `openclaw` references unless explicitly asked.
- The default branch is `storeclaw`, not `main`. All PR workflows, rebases, and `origin/main` references in scripts target `origin/storeclaw`.
- The product is **StoreClaw**. The CLI will become `storeclaw`. Config will move to `~/.storeclaw/`. This migration is in progress.

## What StoreClaw Is

StoreClaw is an agentic AI assistant for micro enterprises — especially retail and ecommerce. The product vision and feature set are actively being shaped; do not assume existing OpenClaw features define what StoreClaw will be.

StoreClaw currently focuses on helping the business owner and their team. Customer-facing features are not in scope yet.

## Build & Dev Commands

- **Runtime**: Node 22+
- **Install**: `pnpm install`
- **Build**: `pnpm build`
- **Type-check**: `pnpm tsgo`
- **Lint/format**: `pnpm check` (Oxlint + Oxfmt)
- **Format fix**: `pnpm format:fix`
- **Tests**: `pnpm test` (Vitest)
- **Dev**: `pnpm dev`

## Key Conventions

- TypeScript (ESM), strict typing, avoid `any`.
- Tests colocated as `*.test.ts` next to source.
- Keep files under ~500 LOC; split when clarity improves.
- Commits via `scripts/committer "<msg>" <file...>` (not manual git add/commit).
- Run `pnpm check` before committing.

## Thesis Docs

Design thesis lives in `thesis/`. Each file has YAML frontmatter with `summary` and `read_when` hints — consult these before architectural or product decisions.

## Further Reading

- Full repo guidelines: `AGENTS.md`
- Contributing guide: `CONTRIBUTING.md`
- PR workflow: `.agents/skills/PR_WORKFLOW.md`
