# Instructions for AI coding agents (Codex, etc.)

This is a live SaaS — `app.abcsurrogacy.com` — with real customer data behind a Supabase backend. **Treat production as fragile.** Before doing anything else, read `CLAUDE.md` in the repo root for the full project context. The deploy workflow below is non-negotiable.

## Deploy Workflow

| When the user says... | Do this |
|---|---|
| "deploy" / "deploy to staging" / "ship to staging" | Commit + push current work to the **`staging`** branch only. Cloudflare auto-deploys to the staging environment. |
| "promote to prod" / "deploy to production" / "merge to main" | Fast-forward `main` from `staging` and push. This is the **only** time it's OK to push to `main`. |
| Anything ambiguous about deploy target | **Ask which target.** Never assume `main`. |

## Hard Rules

- Never push directly to `main` without explicit user approval for that specific change.
- Never run destructive SQL/migrations against the production Supabase project (`ertvelqlskevksgaanwd` / `db.abcsurrogacy.com`) from a local shell.
- Audit every pre-push diff for code that writes to stage statuses, checklist tracking, or anything else that persists production case state. Past pushes have clobbered prod stage data; this isn't hypothetical.
- The local-only `scripts/staging-setup/` directory is gitignored and contains DB credentials. Never commit anything from there or copy its credentials into committed files.

## Environments

| Env | URL | Git branch | Supabase |
|-----|-----|-----------|----------|
| Production | `app.abcsurrogacy.com` | `main` | `db.abcsurrogacy.com` |
| Staging | `staging.app.abcsurrogacy.com` (or `staging.abc-surrogacy.pages.dev`) | `staging` | `hdnavfdmadciihsgscmq.supabase.co` |

Staging Supabase is fully separate from prod — no real user data should ever be there.
