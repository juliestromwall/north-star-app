# ABC Surrogacy

Live SaaS at **app.abcsurrogacy.com** with a working Supabase backend. Sensitive production system.

## Domain Context

See `docs/PRODUCT.md` for terminology, user roles, and flows.

## Rules

| Rule | Details |
|------|---------|
| Design | ALWAYS read `DESIGN_RULES.md` before UI changes |
| Features | Update `docs/FEATURES.md` after implementing features |
| Product docs | Update `docs/PRODUCT.md` when adding roles, flows, or terminology |
| **No browser dialogs** | Never use `alert()`, `confirm()`, or `prompt()`. All notifications, warnings, errors, confirmations, validation messages, and feedback MUST use in-app UI — `<Dialog>` for confirms/destructive actions, inline banners or toast-style components for notices/errors, and inline status text for field-level validation. Browser dialogs block the JS thread, can't be styled, leak past route changes, and have caused silent-success bugs (the user clicks OK and the flow proceeds as if validation passed). |

## Tech

- **Stack:** Vite + React + Tailwind CSS v4 + shadcn/ui
- **Backend:** Supabase (`src/lib/supabase.js`, `src/lib/db.js`, schema in `scripts/schema.sql` + various migration files)
- **Hosting:** Cloudflare Pages, deployed from GitHub branches

## Environments

| Env | URL | Branch | Supabase project |
|-----|-----|--------|------------------|
| Production | app.abcsurrogacy.com | `main` | `db.abcsurrogacy.com` (`ertvelqlskevksgaanwd`) |
| Staging | staging.app.abcsurrogacy.com (or `staging.abc-surrogacy.pages.dev` until subdomain split is finished) | `staging` | `hdnavfdmadciihsgscmq.supabase.co` |

## Deploy Workflow — IMPORTANT

**Never push to `main` directly.** Production is sensitive and supports live customers. The workflow is always:

1. **Default branch for any commit is `staging`.** When the user says "deploy" or "deploy to staging", commit + push current work to the `staging` branch. Cloudflare Pages auto-deploys to staging.
2. **Promotion to production requires explicit user approval.** Only when the user says "promote to prod", "deploy to production", or "merge to main" — fast-forward `main` from `staging` and push.
3. **Before any push to `main`**, audit the diff for stage-status writes, destructive migrations, or anything that could clobber production data. If you find any, surface it before pushing.
4. If asked to deploy without specifying a target, **ask** which target. Do not assume `main`.

## Production Safety

- Production data has caused real incidents when local code accidentally wrote to it. Audit every diff before pushing.
- Never run destructive scripts against production from a local shell.
- The local-only `scripts/staging-setup/` directory contains DB credentials and is gitignored — never commit anything from there.

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/constants.js` | Roles, match stages, statuses |
| `src/context/RoleContext.jsx` | Role state + mock user switching |
| `src/context/AdminNotesContext.jsx` | Admin notes state (mock, in-memory) |
| `src/lib/supabase.js` | Supabase client init (dormant — no .env yet) |
| `src/lib/db.js` | Supabase query helpers (dormant) |
| `scripts/schema.sql` | PostgreSQL schema for future migration |
