# ABC Surrogacy

UI/UX prototype. **No backend yet** — all data is mocked via React state/context.

## Domain Context

See `docs/PRODUCT.md` for terminology, user roles, and flows.

## Rules

| Rule | Details |
|------|---------|
| Design | ALWAYS read `DESIGN_RULES.md` before UI changes |
| Features | Update `docs/FEATURES.md` after implementing features |
| Product docs | Update `docs/PRODUCT.md` when adding roles, flows, or terminology |
| Constraints | All data is mocked. Supabase client + schema exist for future backend integration. |

## Tech & Deploy

- **Stack:** Vite + React + Tailwind CSS v4 + shadcn/ui
- **Status:** Prototype only (rebuild with `app-production` for production)
- **Future backend:** Supabase client (`src/lib/supabase.js`), query helpers (`src/lib/db.js`), schema (`scripts/schema.sql`) are ready but dormant until `.env` is configured

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/constants.js` | Roles, match stages, statuses |
| `src/context/RoleContext.jsx` | Role state + mock user switching |
| `src/context/AdminNotesContext.jsx` | Admin notes state (mock, in-memory) |
| `src/lib/supabase.js` | Supabase client init (dormant — no .env yet) |
| `src/lib/db.js` | Supabase query helpers (dormant) |
| `scripts/schema.sql` | PostgreSQL schema for future migration |
