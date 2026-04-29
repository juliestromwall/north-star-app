# Session Log

## 2026-04-28 (Kaiser PDF overlay polish: audit trail, mobile sign card, address fallback, signature offset)

**Worked on:** Continued the Kaiser PHI Release e-sign flow that pixel-perfects onto Kaiser's exact AcroForm PDF. Three polish items the user surfaced after the prior round of calibration: signature image floated above the underline, mobile UX had no clear sign target, and the GC's address didn't populate when it lived only on the surrogate's separate Personal Information profile (not in the application). Plus the user asked for the ESIGN/UETA audit-trail certificate that the doc-first releases attach — Kaiser was uploading the baked PDF without it.

**Changes made (commit `3f1486b`, pushed to `main` per user approval — staging lacks Google API for end-to-end test):**

- `src/lib/pdfOverlay.js` — new `appendAuditTrailPage(pdfBlob, audit)` helper that draws an ESIGN/UETA "Electronic Signature Certificate" page natively with pdf-lib (no html2canvas dance). Captures document title + ID, completed timestamp, signer name + email, signature type (typed/drawn) + name, and `navigator.userAgent`. Indigo accent bar, two-column rows, footer disclaimer about ESIGN Act + UETA. Same evidentiary content as `generateAuditTrailHtml` from the doc-first releases, just rendered as a native PDF page rather than html-to-canvas.
- `src/lib/pdfOverlay.js` — `bakePdfOverlay()` AcroForm signature path got a `SIG_Y_OFFSET = -Math.round(rect.height * 0.5)` pull-down so the drawn-signature canvas's white-space padding doesn't leave the visible ink floating above Kaiser's pre-printed signature underline.
- `src/components/esign/PdfOverlaySigner.jsx` — added a dedicated "Your signature" Card below the PDF preview, always visible. Wires the same `signatures.signature` state as the inline coord-positioned widget on the PDF, so signing in either place reflects in both. Primary entry point on mobile where the inline widget is too small to tap reliably.
- `src/pages/esign/SignFormPage.jsx` `KaiserPdfOverlayBranch` — address fallback chain extended to walk through `_confidential` → top-level intake answers → `_application` → `surrogate_profiles.profile_data.personal.*` (looked up by email). Each component (street/city/state/zip/phone) falls through independently, so partial profile data still helps. User reported their surrogate had address only on their separate Personal Information profile page, not in the original application.
- `src/pages/esign/SignFormPage.jsx` `handleSign` — calls `appendAuditTrailPage()` between bake and upload, so the file that lands in `case_documents` already contains the audit cert page. Uses the user's signature type/name + the canonical `doc.id` / `doc.title` / `mySigner.*` data; navigator userAgent baked in client-side.

**Why we stayed on `main`:** Per CLAUDE.md the default deploy target is `staging`, but the user explicitly approved production this round (and the prior Kaiser test cycle was already on `main`) because staging doesn't have the Google API needed to actually exercise the email + sign flow end-to-end. Build was clean (`npm run build` ✓), single commit, no migrations, no destructive ops.

**Audit trail mechanics — important context:**
- `signDocument()` in `src/lib/esign.js` already inserts an `esign_audit_log` row with action='signed', actor_name, actor_email, ip_address (empty client-side), user_agent, details. That's the database side — it was firing all along for Kaiser.
- What was missing was the *visible* audit page baked into the PDF itself — that's what `appendAuditTrailPage` adds. Two layers of audit trail now: (1) the DB row in `esign_audit_log`, (2) the cert page on page N+1 of the signed PDF.

**Next steps:**
- Watch the next Kaiser send for: signature offset landing correctly on the underline (offset is `-Math.round(rect.height * 0.5)`, may need tuning per actual visual), mobile sign card discoverability, audit page formatting.
- The other Kaiser fixes from this session series (AcroForm PDF, formatPhone for Kaiser, formatDob, Step 1 admin pre-fill) are all live on prod via `c3d70d1` + `7041ae2` + `1761fe9` (last week's session).
- (Carried) Codex still owes the `fetchSurrogateProfileByEmail` `user_id IS NOT NULL` tiebreaker fix.
- (Carried) `/api/notify-app-released` still uses Gmail (`sendEmail` from `@/lib/google`); worth migrating to Resend like the IP equivalents.

**Open questions:**
- Whether the user actually wants Kaiser PDF audit cert text to mirror the HTML version's *exact* font/layout, or whether the native pdf-lib rendering is fine. Native is much faster and crisper but visually different from `generateAuditTrailHtml` output.
- The SIG_Y_OFFSET is `-rect.height * 0.5` — half the rect height. If the user's drawn signatures still look floaty or now sit too low, this is the knob to turn.

## 2026-04-21 Session D (Full IP portal build-out: profile submission, application forms, prefill chain)

**Worked on:** End-to-end IP portal lifecycle that mirrors the surrogate flow. Profile submit/approve/release/reopen, branded portal invite via Resend, IP-specific application forms (Contact / Clinic / References), admin actions, auto-save, country support, intake→profile→application prefill chain. Also restored 3 mid-session Warp transcripts at the very start (no code changes — confirmed all 3 were already committed before the freeze) and applied two outstanding DB migrations to prod (`admin_note_replies` table + 6 `journey_expenses` columns) before fast-forwarding 21 staging commits to `main`.

**Changes made:**

- `32b1c39` `IntakeLandingPage.jsx` — turned the "See if you qualify in less than 5 minutes" pill into a clickable button that navigates to `/apply/surrogate` (Step 1 of the quiz). Marketing wanted two entry points.
- `155ac43` New `functions/api/ip-invite.js` (Resend-based, replaces the Gmail-API path that died silently when admin tokens expired). `IPDetailPage.jsx` invite buttons (primary IP + partner) now use it. "Partner Portal Active" label fixed to require `lastSignIn`, with "Resend Invite" / "Hasn't logged in yet" middle state.
- `854cc82` IP profile submission + dashboard redesign. New `/api/notify-ip-profile-submitted` endpoint (Resend → julie@ / nicole@ / intake@). `IPProfilePage` got the submit flow (button, warning modal, lock state, banners) keyed off `intake_submissions.answers._profileSubmitted` / `_profileReleasedAt`. `IPDashboard` rewritten to match surrogate layout (white cards + accent bars, ProgressRing, Continue button) — removed the heavy Heart banner.
- `56e91e7` Removed the duplicate "Thank you for submitting your profile" banner — only the amber Profile Submitted progress card now (matches surrogate).
- `3d2b2c3` Required-fields warning modal on IP profile submit (lists incomplete sections, mirrors surrogate). Per-person conditional fields fixed in `countCompletion`/`countSectionCompletion` — IP1's "no" no longer hides IP2's required follow-ups. Admin "Release Application" extended to also handle approved state (clears `_approved` + sets `_profileReleasedAt`). Green "Profile Approved" state added to `IPProfileProgressCard`.
- `5464489` Renamed admin button "Release Application" → "Reopen for Editing" (clearer, doesn't conflict with the application-release flow).
- `24c11dc` Reopen for Editing button moved from `IPDetailPage` header to the admin's Profile tab (`IPProfileTab`). Header keeps a read-only status badge.
- `bf9e34d` New "Release Application" admin action (separate from approve/reopen) + new endpoints `notify-ip-app-released` (emails IP1+IP2 via Resend) and `notify-ip-app-submitted` (emails admins). `PortalApplicationPage` detects IP vs surrogate via `intake_submissions.intake_type`, routes IP submits to IP endpoint with `case_type: 'ip'`.
- `68bca52` Moved Release Application action from IPProfileTab into `IPDetailPage` case-card header (replacing the read-only "Profile Approved" badge spot). State-aware: shows the button when approved+not-released, then "Application Released", then "Application Submitted".
- `6ee1802` Browser-native `window.confirm` for Release Application swapped for proper shadcn Dialog.
- `a39235d` Added 3 new IP application form components in `PortalApplicationPage`: `IPContactForm`, `IPPersonalForm`, `IPClinicForm`. Page branches by `intake_type`. New `IP_FORM_SECTIONS` constant alongside the surrogate `FORM_SECTIONS`.
- `2638ffc` Dropped IPPersonalForm; user clarified IPs only need Contact / Clinic / References. References reuses surrogate's existing `ReferencesForm` (same `_references` key, name/phone/email/cityState/relationship × 3).
- `db947f3` Multi-fix: (a) Save button bug — `isValidPhone` now accepts any 10-digit format; intake-prefilled phones run through `formatPhone` on hydration. (b) Auto-save: new `useAutoSave` hook on Contact + Clinic, debounce 1.5s. `handleSave` got a `{silent:true}` mode. (c) Removed Clinic fields "Day Frozen", "Anticipated Transfer Date", and the entire Delivery Hospital section. (d) Country field on Contact Info — non-US flips State→Province text and Zip→Postal Code. (e) Submit modal copy: "Application is 100% complete. Submit application?" + bold no-edit warning. (f) IP dashboard: prominent "You can now complete the remaining Application" CTA card at the top with "Complete Application →" button when `_applicationAvailable`.
- `7a09bdb` Admin `IPApplicationTab` rewired so Contact / Clinic / References sections use the SAME field shape as the IP-side forms (was reading `_ipReferences` instead of `_references`, had different per-person field names for Contact, only had 3 Clinic fields). Also added Country field to the Add IP modal in `IPListPage` with the same non-US fallback.
- `52f98f3` Prefill chain so the IP never answers the same question twice: profile (`IPProfilePage`) switched from section-level to per-field intake prefill (using `fillIfEmpty` helper) so prefill survives one-field edits; application forms now look at `_ipProfile` data BEFORE intake (Clinic prefills clinicName, reDoctorName, embryoCount, embryosTested, usingEggDonor, usingSpermDonor from profile; Contact prefills DOB from `profile.ip1.personal.dob`).

**Prod DB migrations applied (early in the session, manually via Supabase SQL editor with user running them):**

```sql
-- admin_note_replies table + 5 RLS policies (idempotent w/ DROP POLICY IF EXISTS)
-- Casts admin_notes.created_by::text and target_user_ids::text[] for prod where they're text not uuid

-- journey_expenses columns:
ALTER TABLE journey_expenses ADD COLUMN IF NOT EXISTS disbursement_requested_at timestamptz;
ALTER TABLE journey_expenses ADD COLUMN IF NOT EXISTS disbursement_requested_by text;
ALTER TABLE journey_expenses ADD COLUMN IF NOT EXISTS disbursement_paid_at      timestamptz;
ALTER TABLE journey_expenses ADD COLUMN IF NOT EXISTS disbursement_paid_by      text;
ALTER TABLE journey_expenses ADD COLUMN IF NOT EXISTS surrogate_id              bigint;
ALTER TABLE journey_expenses ALTER COLUMN journey_id DROP NOT NULL;
```

**New endpoints (all Resend-based, env vars `RESEND_API_KEY` + `WELCOME_FROM_EMAIL` already set in prod):**
- `POST /api/ip-invite` — admin invites IP, sends "Welcome to your secure portal" template
- `POST /api/notify-ip-profile-submitted` — IP submits matching profile → admins notified
- `POST /api/notify-ip-app-released` — admin releases application → IP1+IP2 notified
- `POST /api/notify-ip-app-submitted` — IP submits application → admins notified + case_task created with `case_type: 'ip'` assigned to `intake_submissions.assigned_to`

**State storage** (no DB migration needed — all in `intake_submissions.answers` JSON):
- Profile: `_profileSubmitted`, `_profileSubmittedAt`, `_profileSubmittedBy`, `_profileReleasedAt`, `_profileReleasedBy`
- IP profile data: `_ipProfile.{fertility,surrogacy,ip1,ip2}` (existing) + `_ipProfile._approved`, `_ipProfile._approvedAt`
- Application: `_applicationAvailable`, `_applicationReleasedAt`, `_applicationReleasedBy`, `_applicationSubmitted`, `_applicationSubmittedAt`
- Application sections: `_ipContact`, `_ipClinic`, `_references`

**Cloudflare Pages quirks observed:**
- Builds got stuck in "Initializing build environment" for 6+ min once. Fixed via empty commit `5f1a2d0` to kick a fresh build. Worth remembering: Cloudflare serializes builds per-project, so a stuck build holds up the whole queue.
- Discovered there were 5 commits on `main` not on `staging` (email/Gmail features pushed direct to prod earlier). Had to merge `main` into `staging` before fast-forwarding. One JSX bug surfaced from the merge (duplicate `inboxThreads` useMemo in `CaseEmailsTab.jsx` line 399) — fixed in `cc1021f` before promoting.

**Next steps:**
- (From Session A) Codex still owes the `fetchSurrogateProfileByEmail` `user_id IS NOT NULL` tiebreaker fix.
- The surrogate's old `/api/notify-app-released` still uses Gmail (`sendEmail` from `@/lib/google`), which has the same fragility we saw with invites. Worth migrating it to Resend.
- Removed Clinic fields (Day Frozen, Anticipated Transfer Date, Delivery Hospital) are still in the IP-side admin tab as IP profile fields — only dropped from the application form.
- Country field is in: intake form (already there), application Contact form, Add IP modal, admin IPApplicationTab. Not yet added to the surrogate equivalents — would be worth doing if any non-US surrogates ever come through.

**Open questions:**
- For existing IPs whose old `_ipPersonal` data was saved before that section was removed — the data sits in JSON but nothing renders it. Probably fine to leave; only relevant if anyone filled it out today.
- IP 207 — user reported they couldn't see the application after release; provided SQL to manually set `_applicationAvailable: true`. Don't yet know whether that was the previous Cloudflare deploy lag or an actual bug in the release flow. Watch for repeats.
- Multiple parallel Claude sessions kept landing commits between my fast-forwards (Session A's lock trigger, Session B's expense tracker overhaul, Session C's Matched Journeys + Gmail fixes). Surfaced each one to the user but they still got promoted as part of every fast-forward. Worth a coordination convention if multiple sessions become routine.

## 2026-04-21 Session C (Warp-recovery data ops + Matched Journeys UI, SMS scope fix, Gmail 403 fix, emoji picker)

**Worked on:** Recovered after Warp terminal froze with 3 parallel sessions — all prior work was already committed on `staging`. Ran several production data operations, then fixed several UI/UX issues on matched journeys, fixed a leaking SMS notification indicator, fixed email body links, added an emoji picker to compose. Everything shipped through `staging` → `main`.

**Production data ops (all against db.abcsurrogacy.com):**
- Imported 2 new GCs from `/Users/juliestromwall/Downloads/GCs in intake - Sheet1.csv` via `scripts/import-surrogates.js` — 13 of 15 were already in `intake_submissions`, 2 new rows inserted (Mariah Master, Marissa Hawkins).
- Reassigned **72 pre-qualification GCs** to `info@abcsurrogacy.com` (Jennifer Rose) via new `scripts/assign-prequal-to-jennifer.js` — overwrote 10 existing admin assignments, filled 62 nulls, 23 already matched. Stage lookup via `app_config.surrogate_stages` with the default-when-missing rule. Skipped withdrawn/holding.
- Marked **98 qualified GCs as Reviewed** (by Jennifer Rose) via new `scripts/mark-qualified-as-reviewed.js` — sets `intake_submissions.status='reviewed'` and stamps `answers._reviewedAt` / `answers._reviewedBy`. Surrogate dashboard card flips from "Our team is reviewing…" (pink) to "We've reviewed your quiz results!" (emerald).
- Imported Raquel Rodriguez's old profile from `raquelirodriguez@yahoo.com` xlsx via `scripts/import-old-surrogate-profile.js --apply`. New `surrogate_profiles` row `b2ebb324-bd9c-4bd2-a2ff-8ab9f300a84c`, linked to intake id=52 (applicant name mismatch is fine — keyed by email).

**Email migration (juliestromwall@gmail.com → info@abcsurrogacy.com):**
- Provided SQL covering 17 attribution columns across `intake_submissions`, `case_tasks`, `matched_journeys`, `journey_notes`, `profile_shares`, `case_notes`, `case_documents`, `esign_*`, `insurance_payments`, `team_chat_*`. User ran it — verified 0 traces of old email remain in application tables; `info@abcsurrogacy.com` now owns the data.
- `auth.users.email` was NOT touched by the attribution SQL (different subsystem) — which is why the forgot-password email to `info@...` silently failed. Provided SQL to update `auth.users` + `auth.identities` directly in the Supabase SQL editor (`UPDATE auth.users SET email=..., email_change='', email_change_token_new='', email_change_confirm_status=0 WHERE ...` + matching `auth.identities` update for provider=email). **User said Supabase dashboard "edit user" wasn't visible to them — provided SQL route as the fallback, unclear whether they ran it.**

**Commits shipped to staging + main (all UI):**
- `a32bcc6` — MatchedJourneysPage: `STATUS_PRIORITY` const drives custom box order (All Cases, Pending Medical Clearance, Pending Legal Clearance, Legal Clearance Issued, Transfer Prep, Pregnant, Delivered, Holding, then unlisted alphabetized). Archived journeys excluded from "All Cases" and per-status counts; surfaced via `View archived (N)` text link next to the view toggle (not a big box).
- `75612cd` — SMS notification scope fix. `Sidebar.jsx` and `TopBar.jsx` were calling `fetchSMSMessages()` with no args, falling back to env var `TWILIO_PHONE_NUMBER` (Julie's sandbox number), so every admin saw her SMS as unread. Both now read `user_prefs_<uid>.twilioPhone` first; if none configured, no fetch and no dot. If set, scoped to that number.
- `dcda5ee` — `EmailPage.jsx` iframe: wrap srcDoc in `<!doctype html>` shell with `<base target="_blank" rel="noopener noreferrer">` + widen sandbox to `allow-same-origin allow-popups allow-popups-to-escape-sandbox`. Previously, clicking a link inside an email body navigated the iframe itself to the Google URL and got replaced with Google's 403 page. Also added `EmojiPickerButton` in `ComposeWindows.jsx` — 56 curated emojis (smileys, hearts, pregnancy-themed), inserts at Tiptap cursor. No new deps.
- `0e39f03` — Journey list views on both `/dashboard` (myJourneys section) and `/journeys` list view: consolidated redundant Stage + Status + Manager columns into a single **Status** column rendered as a new `JourneyStatusPill` (colored by stage). Manager column dropped — the pink/indigo left edge (Julie Allgood=indigo, Nicole Lawson=pink, via `journeyManagerOutlineColor`) replaces the text. Dashboard list now has that same left edge too.

**Next steps:**
- **Scheduled send (email)** — flagged but not built. Gmail API doesn't expose scheduled send (Gmail UI-only). Needs: `scheduled_emails` table + Cloudflare cron trigger + compose UI with date/time picker + "Scheduled" folder. User asked about it; I recommended scoping as a separate day of work. **Not yet approved to build.**
- **`CaseEmailsTab.jsx` has the same link-click 403 class of bug** as `EmailPage.jsx` but renders via `dangerouslySetInnerHTML` instead of iframe, so the fix is different — either wrap in an iframe too or run a click-time handler that forces `target="_blank"`. Not fixed this session — flagged to user.
- User's uncommitted working tree still has `src/lib/db.js` and `src/pages/profile/SurrogateProfilePage.jsx` modifications from parallel sessions (the Kim-profile fix thread, Session A). Left untouched per the "only commit what I touched" rule.

**Open questions:**
- Did user run the `auth.users.email` SQL in the Supabase SQL editor? Status unknown — they never confirmed.
- Untracked scripts left in working tree (`scripts/assign-prequal-to-jennifer.js`, `scripts/mark-qualified-as-reviewed.js`, plus Session A's `import-*.js`) — user said "just leave as is" earlier. Don't commit without explicit ask.

---

## 2026-04-21 Session B (Expense Tracker overhaul: Submitted-to-Escrow 3-state, cleaner table, IP/GC colored case cell, journey hero pills)

**Worked on:** Full redesign of `/expenses` + per-journey Expenses tab around a new "Submitted to Escrow" disposition column, plus supporting UI polish and one unrelated prod-data cleanup for journey 38.

**Changes made:**

- `603d547` — **Rename "Disbursement" → "Submitted to Escrow"** on both main tracker and per-journey tabs. New 3-state dropdown (`Escrow Not Funded` / `Yes` / `Not Needed`) with `Yes` revealing Mark-as-Paid. Paid + Not Needed rows get emerald background. Admin can un-do any state via the same dropdown. New `journey_expenses.escrow_not_needed boolean` column (`scripts/20260422-add-escrow-not-needed.sql`) — applied to BOTH staging and prod DBs. Also removed the misleading "Escrow Opened" table column (it was rendering `submitted_to_escrow` under the wrong label).
- `f7e1e94` — **Drop "Disbursement already requested?"** from all three Add Expense modals (journey tab, journey hero quick-add, surrogate pre-match). Redundant with Submitted-to-Escrow=Yes. On create, `submitted_to_escrow=true` now auto-stamps `disbursement_requested_at/_by` for audit.
- `1133790` — Initial table padding bump (superseded by `0f489a3`).
- `991918a` — **Journey hero: 2 new count pills** in ESCROW row. `{n} to submit` (orange) — expenses escrow-opened but not yet submitted. `{n} awaiting disbursement` (blue) — submitted but not yet paid. Live-counts from `journeyExpenses` state.
- `43239b3` / `f8a81e0` / `9d4dc30` — Card-layout iterations (abandoned per user feedback "too thick").
- `0f489a3` — **Back to tables, cleaner**: no vertical cell borders, row dividers only, stacked metadata (name / manager · date / Paid badge).
- `60c2d6e` — **Final layout polish**: new `CaseCell` component mirrors `/case-updates` styling (IP name indigo `#283693`, GC name pink `#ed148c`, stacked with `+` between). CC Last 4 promoted to its own column (was crammed under Paid To). `handleSetEscrowStatus` surfaces save errors via `alert()` instead of swallowing them.

**Prod-data cleanup (journey 38):**
- Cleared `disbursement_paid_at/_by` and `disbursement_requested_at/_by` on `journey_expenses.id=30` ($1,000 Brittney Everett bonus) per user request. User manually deleted ids 30, 31 duplicates after my read-only investigation confirmed they were from Add-Expense re-entries, not a code bug.

**Escrow status save debug journey:**
- User reported Submitted-to-Escrow dropdown not saving on staging.
- DB verified: column exists, direct UPDATEs land.
- Root cause suspected: PostgREST schema cache stale after `ALTER TABLE`.
- Applied migration to prod DB too (in case staging build points at prod Supabase URL) + sent `NOTIFY pgrst, 'reload schema'` to both environments via `scripts/staging-setup/reload-postgrest-schema.mjs`.
- Added `alert()` in handler so any lingering failure is visible instead of silent.

**Deploy status:**
- All work on `main` at commit `0e39f03` (which sits on top of `60c2d6e`). A parallel session pushed `0e39f03` ("Journey list views: consolidate stage/status") that includes all expense work. Prod is live with everything.
- DB migration `20260422-add-escrow-not-needed.sql` applied to staging + prod.

**Next steps:**
- User to verify on prod that the Submitted-to-Escrow dropdown saves after the column + schema reload.
- Check for the "Mark Paid duplicates line item" bug when user re-tests in staging.
- Codex's fix for `fetchSurrogateProfileByEmail` duplicate-row tiebreaker (Kim case) is still pending — separate track.

**Open questions:**
- Pre-match surrogate expenses show Pre-match + surrogate name only (no IP yet). Confirm styling feels right once there's pre-match data on prod.
- Should Submitted-to-Escrow column persist last-sort / filter across tab switches? Not asked yet; defer.

---

## 2026-04-21 Session A (Kim profile clobber fix: save-first guard, DB protection trigger, address fix for Escrow Sheet)

**Worked on:** Three interlocking fixes around Kimberly Miller's (surrogate id=195) profile disappearing after approval, plus an Escrow Match Sheet UI change.

**Changes made:**

- `b751e84` — Fix Approve button silently failing when a surrogate has duplicate `surrogate_profiles` rows. PostgREST `.single()` returned 406 on ≥2 rows; admin-side status-update path now writes to all matching rows.
- `1bd73e8` — In `src/pages/profile/SurrogateProfilePage.jsx`, force the pending autosave to flush before flipping status to `pending_review`. Removed `.catch(() => {})` that was silently swallowing autosave failures.
- `1ce0797` — In `src/components/journeys/MatchSheetsTab.jsx` (`EscrowSheet`, ~line 534–593), add address row (Street/City/State/Zip) for IP #1 and Surrogate. 4-column InfoGrid, kept on one page.
- `e2e8b9a` — New `scripts/20260421-lock-approved-profiles.sql`: Postgres BEFORE UPDATE trigger `protect_approved_surrogate_profiles` on `surrogate_profiles` that raises when `profile_data` changes while `status='approved'`. Applied to **both staging and prod** via `scripts/staging-setup/apply-lock-trigger.mjs`. Status changes still allowed (approved → draft to unlock).

**Investigation tooling (local only, gitignored under `scripts/staging-setup/`):**
- `backup-kim-profile.mjs` — snapshot Kim's rows → JSON. Produced `kim-profile-backup-2026-04-21T22-14-41-874Z.json` (canonical row id=`ef3f98f9-8033-4b64-8886-06be4141a1bc`, 10 sections / 110 fields).
- `kim-deep-search.mjs`, `kim-recovery.mjs` — scan storage, jsonb columns, audit/history tables for any other copies. None found; the local JSON backup is the only offsite copy.
- `kim-check-current.mjs` — verify current row state in prod.

**Kim incident resolution (2026-04-21 night):**
User said "I approved it and it disappeared!" after the trigger was installed. Checked prod: canonical row `ef3f98f9…` is intact with 10 sections / 110 fields (now status='draft'). The orphan row `c4fe5655…` (user_id=NULL, 1 section / 7 fields, created by intake) also exists with the same `updated_at`. **Data was never lost** — this is an admin-view bug: `fetchSurrogateProfileByEmail` in `src/lib/db.js:631–642` orders by `updated_at desc` + `.limit(1)` + `.single()`, and when both rows have identical timestamps (they do, because status updates write to all rows by email) it returns arbitrarily — sometimes the 7-field orphan. User asked Codex to take the code fix; no action taken in this session.

**Next steps:**
- Codex: fix `fetchSurrogateProfileByEmail` in `src/lib/db.js` to prefer `user_id IS NOT NULL` as the tiebreaker (or filter out orphans entirely when a canonical row exists for the same email).
- Address duplicate-row creation at the root: when a surrogate logs in and an intake-created orphan exists for their email, adopt it (set `user_id`) instead of inserting a new canonical row.
- Add a server-side completion gate on `/api/notify-profile-submitted` so a partial profile can't trigger the "submitted" email.
- Escrow Match Sheet address change + lock trigger SQL are already on staging AND prod (`e2e8b9a` is on main).

**Open questions:**
- Both Kim rows currently show `status='draft'` — something flipped her back from `approved`. Unclear whether user did it manually to "recover" or whether admin-view or approve path wrote 'draft' somewhere. Worth auditing once Codex's fix lands.
- Should the orphan row `c4fe5655…` be deleted now that the canonical has all data? User said "leave it alone" for tonight. Revisit with the duplicate-adoption fix.

---

## 2026-04-15 — 2026-04-16 Session A (Multi-Admin SMS, Team Chats, Therapist Check-Ins, Application Restructure)

**Worked on:** Multi-admin Twilio SMS with Send-As + merged threads, Team Chats internal messaging, Therapist Check-In Report Builder with PDF generation, application restructure (combine Personal+Confidential), several auto-email notifications, profile UI improvements.

**Changes made:**

Multi-Admin Twilio SMS:
- Per-admin Twilio phone number in Settings (stored in user_prefs)
- /api/sms/send accepts optional `from` param
- /api/sms/list accepts comma-separated `numbers` to fetch from multiple lines
- /api/admin-phones returns admins with configured numbers
- CaseTextsTab: "Send as" dropdown, merged multi-admin threads, sender name on each bubble
- Discussed Toktiv app for iPhone calls/texts using Twilio number

Team Chats (NEW):
- /team-chats nav item under INBOX
- team_chat_groups + team_chat_messages tables
- iMessage-style two-panel UI with group list + thread
- "New Chat" dialog (name + member checkboxes, max 10)
- 3 endpoints: /api/team-chats/groups, /messages, /list
- Sending → Supabase insert + Twilio SMS to all other members
- Polls every 10s, mobile responsive

Therapist Check-In Report Builder:
- "Due Date" → "Estimated Due Date", new "Birth Guidelines" column
- "+ Add date" → "Check In" buttons (open report dialog)
- 95vw wide dialog with full report builder:
  - Pre-fill: Jenny Oliver-Miramontes LMFT, MA License 51961
  - Pacific Time everywhere
  - Rich text Communication Details
  - "Requested By" auto-fills case manager from journey assigned admin
  - Polished UI: blue section headers + icons + tinted cards
- Real PDF via html2pdf.js (was uploading HTML as fake PDF)
- /api/therapist-checkin server endpoint with service role bypasses RLS
- PDF saves to surrogate's psych-evaluation folder (not psych or "Other")
- Task on matched journey if matched, surrogate case otherwise:
  "{GC Name} {Check-In Event} Complete - Needs Review"
- "Are you sure?" confirmation dialog before submit
- PDF redesigned compact card layout matching Records Summary style

Application Restructure (Portal + Admin):
- Combined Personal + Confidential into one "Personal Information" section
- Removed NICU questions and Driver's License # field
- spouseFullName → spouseFirstName, added spouseDob
- Insurance card front/back photo uploads
- Pre-fill city/state, partner first name, partner DOB from profile
- Admin Follow-Up Questions now editable
- Quick links bar at top of admin Application tab (8 sections)
- New order: Quiz → Personal → Follow Up → References → Clinic → Payment → Social → Background Waivers

Auto-Emails:
- /api/notify-app-released: surrogate gets email when admin opens app
  ("🥳 I've reviewed your Profile!"). Admin sees confirmation: Cancel/Release & Email/Just Release
- /api/notify-app-submitted: admin notified when surrogate submits app
- notify-profile-submitted: added Julie's gmail, fixed full name from quiz, 🚨 emoji

Profile/Submit Improvements:
- Insurance status indicator on preview header (Verified/Verifying/Needs Policy)
- Submit Profile button moved to header (next to Preview) when 100%
- Fixed 100% popup not waiting for status to load
- Experienced Surrogate field reads from quiz answers as fallback
- Server-side checklist logging in /api/notify-profile-submitted
  (was failing client-side due to RLS)
- High priority on profile review task

Bug Fixes:
- Photo crop modal forced to 95vw / 1400px max width
- startsWith TypeError on numeric surrogate IDs (String() cast)
- Therapist check-in PDF folder ID corrected
- Removed silent .catch(() => {}) that hid task creation errors

**Next steps:**
- Verify therapist check-in PDF + task creation works in production after deploy
- Show full birthdate (MM/DD/YYYY) for baby in pregnancy section (deferred)

**Open questions:**
- Therapist check-in: user reported "still didn't work" but console only showed unrelated warnings (no /api/therapist-checkin response logged). Need to confirm latest deploy and capture network tab response.

## 2026-04-16 (Dashboard UI Polish, Quiz Additions, Task Enhancements, Gmail Autocomplete, Auto-Tasks)

**Worked on:** Surrogate dashboard visual redesign, experienced surrogate quiz question + profile updates, task assignment for Julie & Nicole (joint), Future Tasks dropdown, delete/expand/incomplete on dashboard tasks, Gmail recipient autocomplete, more auto-task triggers, documentation of all auto-tasks.

**Changes made:**

Surrogate Dashboard UI:
- Removed "We're so glad you're here" subtitle from all GC/IP dashboards
- Clean white cards with colored accent bars (replaces shadcn Card boxes + tight spacing)
- Application card: green accent on submit, indigo→pink gradient while pending
- Profile card: dynamic title — "My Profile" → "Profile Submitted" (amber) → "Profile Approved" (green)
- Application submit: scroll to top + updated message with date, next steps, contact for edits
- Contact footer simplified to inline text (no card)
- IP dashboard subtitle also removed

Profile:
- Removed 100% auto-popup (triggered mid-keystroke on long text)
- First-visit welcome modal (localStorage-tracked) about photos + submission
- Submit button always visible — opens warning or submit dialog based on %
- Fix: isPregnancyComplete missing import (pregnancy history crash)

Surrogate Quiz:
- New question on step 4: "Are you an experienced surrogate?" (Yes/No)
- Quiz answer pre-fills profile's experiencedSurrogate.previousSurrogate
- Pregnancy History: removed "Ectopic Pregnancy" from complications checklist (already an outcome)
- Pregnancy History: "Was this a surrogacy pregnancy?" only shows if experienced

Admin Views:
- GCApplicationTab quiz section: added Experienced Surrogate field + (BE) Referral toggle
- SurrogateDetailPage quiz edit form: added Experienced Surrogate yes/no + saved to answers

Task Assignment — Julie & Nicole (joint):
- Add "Julie & Nicole" combo option in task assign dropdowns (case widget + dashboard)
- Combo stores comma-separated emails; fetchMyTasks matches via OR/ilike
- Task row displays combo name "Julie & Nicole" instead of raw emails
- Both dashboard Add Task + Edit Task dropdowns show the combo

Future Tasks Dropdown:
- Tasks due >7 days out collapse into "Future Tasks (N)" dropdown on dashboard + case widgets
- Current (≤7 days or no due date) tasks always shown

Dashboard Task Enhancements:
- Delete button (trash icon) on all task rows
- Click task row to expand: shows case link, assigned to, created by, completed by, notes
- Click green checkmark on completed task to mark incomplete (moves back to open)

Gmail Recipient Autocomplete:
- fetchEmailContacts() pulls 200 sent + 200 inbox messages, extracts unique addresses
- 24h localStorage cache per user
- addEmailContactToCache() updates after each send
- RecipientInput component with dropdown: name + email + avatar, keyboard nav (arrows/Enter/Tab/Esc)
- Used for To, Cc, Bcc fields
- Supports comma/semicolon-separated multi-recipient input

New Auto-Tasks:
- Heartbeat confirmed → "🤰 {GC Name} - 20wks Check in with IP(s)" for Julie & Nicole (121 days post-transfer)
- Heartbeat confirmed → "Confirmation of Heartbeat - Collect 4th Agency Payment" for Julie & Nicole
- Medical Clearance complete (journey) → "{GC Name} Medically Cleared - Collect 3rd Agency Payment" for Julie & Nicole
- Reference Check requested → "Complete Reference Checks for {GC Name}" for intake@abcsurrogacy.com

Email Fix:
- All Jennifer Rose auto-tasks updated from jennifer@ → intake@abcsurrogacy.com (testimony, reference check)

Documentation:
- docs/AUTO_TASKS.csv — 26 auto-task triggers with title, assignee, priority, due date, source file

**Next steps:**
- Pick up in the am — user signed off for the night
- Match-Centric Case Architecture plan still pending (not started)
- Consider configurable auto-task rules from Settings

**Open questions:**
- None

---

## 2026-04-14 — 2026-04-15 Session B (Email, Admin Notes, Tasks, Auto-Tasks, Records Summary)

**Worked on:** Email compose improvements, admin notes rich text editing, dashboard task features, auto-task creation for checklists, records summary merge/complete, pregnancy multiples, Terms & Privacy Policy

**Changes made:**

Email: Attach from case documents button, CC always visible, Reply All button. Admin Notes: Rich text editor with images + float alignment, edit existing notes, mark as read (collapse). Dashboard Tasks: Assign to any admin (defaults to self + today), edit tasks, completed tasks dropdown. Auto-Tasks: Connect with Applicant follow-ups (2/7/14/1 day cadence), Medical/Legal Clearance incentive payment tasks for Julie Allgood (referral + screening), works on both surrogate + journey pages. Records Summary: Drag-reorder merge, visible checkboxes with order badges, Complete button files to Medical Records + creates review tasks. Pregnancy: Baby A/B/C for multiples. Case-updates: removed green bg, info row styling, % Profile Complete. Terms & Privacy Policy document + password-set acknowledgment.

**Next steps:**
- Test email attach from documents end-to-end
- Consider configurable auto-task rules from Settings

---

## 2026-04-15 (Cover Photo Fix, Photo Dialogs, Portrait Overlay, Question Auto-Email, Share Email)

**Worked on:** Fixing cover photo display across all previews, in-app photo delete dialogs, portrait overlay on cover photos, question auto-email with case note logging, share profile email restyle, mark-as-answered for match questions.

**Changes made:**

Cover Photo Fixes:
- Admin preview loaded photos fresh (AdminGallery was overwriting state with gallery-only)
- Surrogate portal: intakeCaseId moved to own useEffect (was trapped behind early return)
- Shared profile page (/share/...): loads from both auth UUID and intake case ID paths
- Cover photo crop: 16:9 aspect ratio with grid overlay

Profile Portrait Overlay:
- Portrait photo overlays bottom-left of cover photo, straddling the edge
- Works in all contexts: surrogate preview, admin preview, shared link, PDF/print

Photo Delete Dialogs:
- Created ConfirmDialog component, replaced 6 browser confirm() calls

Admin Crop/Rotate for Profile & Cover:
- AdminPhotoSlot has crop/rotate button, cover at 16:9, profile at 1:1

Question Auto-Email:
- Emoji subject, table layout, HIPAA warning, first name only
- Server-side logs case notes on surrogate + IP cases
- Match History shows questions with "Pending — click to mark answered"

Share Profile Email:
- Standard template with logo, HIPAA, gradient button "View {Name}'s Profile"

**Next steps:**
- Remove deleted fields from ProfilePreview
- Update remaining ProfilePreview labels
- Add Follow Up Questions to PortalApplicationPage
- Email improvements: attach from case docs, CC always open, Reply All

**Open questions:**
- None

## 2026-04-15 (Checklist UI, Case Updates UI, Expenses, Auto Emails, Admin Settings, Pregnancy Tracker, HIPAA)

**Worked on:** Major UI overhauls for checklist and case updates, expense escrow flow, auto emails for pregnancy + records, admin settings, pregnancy tracker enhancements, HIPAA-compliant psych sharing, referrals & incentives, surrogate application updates

**Changes made:**

Dashboard:
- Past 7 days appointments with follow-up + notes (collapsible)
- Follow-up and notes on upcoming appointments too
- List view with proper table layouts matching other pages (avatars, badges, columns)
- Default view preference loaded from admin settings

Checklist UI Overhaul (TrackingTable):
- Card-based layout replacing rigid table — accent bars, filled circle indicators
- Inline log preview below step names, labeled form fields
- Eye toggle for instant deactivate/reactivate (no log entries created)
- Default log date to today, rename restricted to text-type fields only
- + subtask button moved next to step label
- Progress bar with indigo→pink gradient, percentage display

Case Updates UI Overhaul:
- Status cells with colored backgrounds (green=complete, blue=in progress, etc.)
- Clickable cells toggle detail popover (replaced confusing ScrollText/ClipboardPlus icons)
- Unified popover with Subtasks → Records → History sections
- Full notes visible in popover (no truncation), truncated in cell preview
- Everything centered (steps, headers, info rows, case names)
- "Checklist Steps" header label, AI icon-only (removed "Summary" text)
- Filtered by assigned admin (super/master see all)

Expense Enhancements:
- Escrow Opened Y/N toggle — conditional fields based on answer
- "Who needs to be paid?" dropdown (Surrogate/IP1/IP2/Other)
- Surrogate payment preference (Venmo/Zelle) pulled from application
- "Expenses to Pay" tab on Expense Tracker with mark paid + reconcile
- Auto-task for Julie Allgood when escrow not opened
- Date defaults to today

Admin Settings:
- Profile image upload (stored in Supabase, shown across app)
- Timezone selection (US, defaults to Pacific)
- Default case view preference (Card/List) — persisted and applied across all pages

Pregnancy Tracker:
- Cancel Cycle button with optional reason
- Beta HCG date fields (default today) in log + edit dialogs
- Delete Birth with confirmation (reverts to Pregnant status)
- Auto-task: Jennifer Rose testimony reminder 1 month after birth
- Auto-email on heartbeat confirmation (pregnancy confirmed)

Auto Emails:
- Pregnancy confirmed email (surrogate name, psych check-in link, HIPAA notice)
- Records Summary requested email (surrogate name, direct link, HIPAA notice)
- Both use branded ABC template via Resend API + Cloudflare Functions

HIPAA-Compliant Psych Sharing:
- Password-protected shared psych tracking page
- First visit: set password (SHA-256 hashed, min 8 chars)
- Return visits: enter password to unlock
- Session persists via sessionStorage
- Admin can reset password from Share dialog

Referrals & Incentives:
- Renamed from "Referral & Bonus" throughout (nav, header, tabs)
- ALL surrogates now appear on Incentive Payment tab (not just matched)
- Pay Via column with Venmo/Zelle info + screenshot preview (eye icon)

Surrogate Application:
- Profile Follow Up Questions section (between Personal Info and Confidential)
- Screening Incentive Payment Preference section (Venmo/Zelle + screenshot)
- Both visible to surrogates in portal with save/complete tracking

Other Fixes:
- Journey card shows surrogate DOB on /journeys
- Escrow minimum defaults to $10,000
- Storage upload path sanitization (spaces → underscores)
- RichTextEditor syncs content on prop change (fixes edit admin notes)
- Screenshot auto-saves immediately on upload

**Next steps:**
- Match-Centric Case Architecture (plan exists, not started)
- GC Background Waiver form field cleanup (user feedback pending)
- Profile Follow Up Questions field review with agency

**Open questions:**
- Jennifer Rose's email — using jennifer@abcsurrogacy.com (confirm correct)

## 2026-04-14 (Gmail Inbox Integration, Journey Updates, Provider Info, Profile Label Alignment, Quick Notes)

**Worked on:** Gmail inbox on case Emails tab, Journey Update logging, Provider Info modal, profile field label alignment, Quick Notes, attachment preview/save, email log dialog with tags

**Changes made:**

Gmail Inbox Integration:
- Emails tab now has Logged/Inbox toggle
- Inbox searches Gmail for emails from/to case contacts (surrogate, IP1, IP2, journey parties)
- Unread emails highlighted with "New" badge + flashing pink dot on Emails tab
- Click to view full email with HTML body + attachments
- Attachments: Preview (opens in new tab), Save to Case (folder picker dialog)
- Log dialog with tag selector + private option when logging inbox emails
- Marks emails as read in Gmail when opened
- Already-logged emails filtered out of inbox view

Journey Update Log:
- JourneyUpdateButton on hero cards (surrogates, IPs, journeys)
- Compact icon on case-updates title row (megaphone)
- Modal with timestamped update entries, author attribution, delete
- Stored per-case in app_config

Provider Info Modal:
- ProviderInfoButton on case-updates title row (building icon)
- Shows IVF Clinic, Monitoring Clinic, IP/GC Attorney, Escrow (default SeedTrust), Insurance, OB Clinic, MFM Clinic, Delivery Hospital
- Data pulled from journey_data + insurance records

Quick Note:
- Collapsible text area above tabs on every case page (surrogates, IPs, journeys)
- Auto-saves after 1 second, persists in app_config per case
- Yellow-tinted background, shows preview when collapsed

Profile Field Labels:
- Created FIELD_LABELS map (150+ fields) in profileConstants.js
- Admin formatFieldLabel() now uses map — shows full question text
- ProfilePreview fertility section labels updated to match portal
- Generated surrogate-profile-fields.csv for review

Case Updates Title Row:
- AI Summary now icon-only (sparkles, no "Summary" text)
- Added Journey Update megaphone icon
- Added Provider Info building icon
- More room for all icons

Other:
- Email body storage fix for cross-admin viewing
- Attachment filename sanitization for Supabase storage
- Cleared stale sticky note data

**Next steps:**
- Build "Profile Follow Up Questions" form (new section after Personal Info)
- DELETE 10 fields from profile (religion, ethnicity, covid questions, RE location)
- MOVE 48 fields to Profile Follow Up Questions form
- UPDATE 7 fields (reDates→Year, embryoSource→multiselect, lifestyleChanges→textarea, pumpBreastmilk→3 options, ipsAtAppointments→3 options, postBirthRelationship→textarea, partnerAgreesTermination→new wording)
- Build admin review window (editable table with notes per answer, opens in new window)
- Continue updating ProfilePreview labels for remaining sections

**Open questions:**
- None

## 2026-04-13 (IP Profile, Checklists, Stages, Appointments, Case Updates, Info Rows)

**Worked on:** IP profile preview improvements, GC/IP/Journey checklist consolidation, IP stages, appointment follow-up system, case-updates appointments view, journey info rows, monitoring clinic

**Changes made:**

IP Profile Preview:
- DOB formatted MM/DD/YYYY, ages in header pills (indigo IP1, pink IP2)
- "None of the above" health condition → displays as "None", hides dates field
- Per-person sections in distinct cards (neutral tint, blue names)
- Section headers pink, IP names blue, age only at top
- Sections restyled to match GC profile (PVSection cards with gradient headers, warm background, 3-column grid)
- Heart icon for Surrogacy Info, HeartPulse for Health Info
- First names only throughout profiles (IP + GC)
- State abbreviations expanded to full names
- GC admin profile: photo upload section (Profile Photo, Cover Photo, Photo Gallery with drag/crop/rotate)

IP Stages:
- New IP_STAGES: Consultation, Matching, Holding, Withdrawn
- Renamed "Screening" → "Consultation" for IPs
- Matched Journey stage hidden from IP list/detail pages
- StageBadge accepts caseType="ip" for correct labels

Checklists:
- Default statuses updated: Requested, Started, In Progress, Followed Up, Note, Complete, Not Needed
- Added Started (cyan) and Note (stone) status colors
- Moved checklist from standalone tab to Overview tab on GC, IP, and Journey cases
- IP Overview redesigned: Milestones (timeline visual matching GC) → Appointments → Tasks → Checklist
- Removed Checklist tab from all case type tab bars

Case Updates:
- Matched GCs and IPs hidden from individual tabs (only in Matched Journeys)
- Appointment badges: calendar icon + count next to each case name, click opens full appointment log modal with notes, follow-up status, and inline note editing

Appointments:
- Follow-up tracking: "Follow Up" button on past appointments, adds ✅ to Google Calendar title, logs admin + date
- Appointment notes: "Add Notes" / "Edit Notes" per appointment, saved in Supabase
- Edit dialog: Notes field grayed out as read-only "Calendar API Note"
- Notes preview shown inline in appointment list

AI Summary:
- All dates MM/DD/YYYY, removed stage from header
- Appointments split into upcoming vs recent past
- Checklist logs included (last 3 entries per step)
- Email snippets included for case activity
- Birth data: delivery date, type, weight, length, names
- "None scheduled" when no upcoming appointments

Journey Info Rows:
- Monitoring Clinic added to journey hero (4-column provider grid)
- Settings → Checklists → Matched Journeys: "+ Add Info Row" for 6 provider fields
- Info rows (IVF Clinic, Monitoring Clinic, IP Attorney, GC Attorney, OB Clinic, Delivery Hospital) render as violet-tinted rows in case-updates journey spreadsheet
- Info rows filtered OUT of actual case checklists — only in case-updates
- Data pulled from journey_data (hero card fields)

Fixes:
- Restored useSortable import for document tab drag-reorder
- Fixed GC profile completion: conditional/partner fields excluded from count
- Status dropdown always includes current status even if not in stage config

**Next steps:**
- Test info rows positioning in Settings
- Consider adding info rows to the actual case checklist (user option)
- Continue with any remaining IP profile parity items

**Open questions:**
- Should info rows be editable from the case-updates spreadsheet? (Currently read-only, edit from journey hero)
- Should monitoring clinic data appear in the AI summary?

---

## 2026-04-13 — 2026-04-14 (Checklist Subtasks, Records Summary PDF, Profiles, Form Templates)

**Worked on:** Checklist subtasks + auto-derive, custom dropdown colors, case-updates page fixes, text field checklist type, Records Summary PDF redesign, GC profile preview completeness, sticky notes neon colors, team management save fix, form template e-sign system (Background Waivers)

**Changes made:**

Checklist System:
- Subtasks with `parentId` field — auto-derived parent status (all complete → parent complete, any started → in_progress)
- Case-specific subtasks (per-case, stored in tracking data with `_isCaseSubtask`)
- Custom dropdown options with `{label, mapsTo}` — mapped to status colors
- Fixed checklist wipe race condition (blocked saves until Supabase loaded, `_loaded` flag)
- Fixed journey `handleUpdate` clobbering subtask with parent cascade (`pendingTrackingRef`)
- Text field checklist type: `_textValue` preserved through complete, pre-fills on re-edit
- Fixed stale closure bug on Complete/NA buttons (`overrideStatus` parameter)

Case Updates Page:
- Subtasks hidden from rows, shown in scroll popover with full log history
- Derived parent status displayed (In Progress / Complete with dates)
- Fixed: only show most recent log in cell, use entry.status not effectiveStatus
- Case-specific subtasks merged into case-updates derivation + popovers

Records Summary PDF:
- Redesigned header: stat cards with Lucide SVG icons (Age/Height/Weight/BMI/Status)
- GTPAL pregnancy history bar with colored chips
- Hot pink section headers (no background)
- General Medical History 2×2 grid, pregnancy grids 4 columns
- Per-pregnancy hidden fields (eye toggle, `_hiddenFields` stored per summary)
- White grid gaps, notes pre-fill from pregnancy complications
- BMI auto-calculates from height/weight

GC Profile Preview:
- Added ~40% of missing fields to match form 1:1 (Fertility, General, Health, Employment, Hopes & Wishes)
- All conditional detail fields (yes/no → explanation)

Sticky Notes:
- Neon colors (yellow, magenta, cyan, green, purple)
- Drag-to-resize height handle

Team Management:
- `POST /api/update-admin` endpoint — persists name/email/role edits to Supabase Auth
- Fixed save handler to call API instead of local-only state update

E-Sign Date Placeholders:
- `{{Date:IP1}}`, `{{Date:IP2}}`, `{{Date:Partner}}`, `{{Date:Admin}}` already supported
- Updated help text to list Partner role + Initials/Checkbox fields

Form Template E-Sign System:
- New `src/lib/formTemplates.js` — template definitions + HTML generators
- `src/pages/esign/SignFormPage.jsx` — email verify, form fields, 3 signature pads, live preview, PDF + audit trail
- `src/components/shared/SendFormTemplateButton.jsx` — send button with signed/pending/unsent status tracking
- GC Background Waiver + Partner Background Waiver on GC Application tab
- IP Background Waiver + IP2 Background Waiver on IP Application tab
- Route: `/e-signature/form/:formToken`

Bug Fixes:
- Email crash: `isMasterAdmin` not defined in EmailDetail
- Build fix: extra `}` in RecordsSummaryWorkspace.jsx
- Build fix: unclosed fragment in IPProfilePage.jsx
- Sign-on bonuses: only show surrogates in matched journeys

**Next steps:**
- Clean up GC Background Waiver form fields (user will provide feedback)
- Match-Centric Case Architecture (plan exists)
- Continue with whatever Julie wants next

**Open questions:**
- None blocking

## 2026-04-13 (Records Summary Fixes, Office Admin Role, Data Cleanup, Email Sharing)

**Worked on:** Records summary improvements (DOB format, COVID removal, pregnancy field logic, PDF page breaks), Office Admin role, selective data cleanup, email body storage for cross-admin viewing, private emails

**Changes made:**

Records Summary:
- DOB formatted as MM/DD/YYYY (was YYYY-MM-DD)
- Removed COVID-19 screening section entirely
- Removed Occupation and Lives With from Social History
- Miscarriage/termination pregnancies: if no prenatal care → skip details; if prenatal care → show only GBS, Glucose Screen, GC Cycle, BPs, Weight Gained
- "Complications" renamed to "Notes" for non-delivery pregnancies
- Flags (isNonDelivery, hadPrenatalCare, skipDetails) now re-derived from clinic data on every load
- Removed Obstetric Summary field
- OB Clearance moved to last row in Most Recent Labs table
- Line breaks preserved in PDF preview (whiteSpace: pre-wrap)
- PDF export switched from html2canvas/jsPDF to browser print dialog with break-inside:avoid CSS
- Pregnancy banner pill alignment fixed (baseline + inline-block)

Email Sharing:
- Email body (body_html) now stored in case_emails table when logging
- Other admins can view logged emails without Gmail access
- Graceful fallback for old emails (shows snippet + explanation instead of error)
- Master admins can mark emails as Private (is_private flag)
- Private emails hidden from non-master admins
- Lock/unlock toggle on email list + in Log to Case dialog
- Migration: case_emails_body_private_migration.sql

Office Admin Role:
- New role: office_admin — normal admin + Settings access (notes, team, statuses, checklists)
- Added to ADMIN_ROLES, navigation, DashboardRouter, admin-users API, getAdminStaff()
- canEditSettings flag for Settings page access
- Role selector in Team Members with purple badge + description

Dashboard & List Pages:
- Dashboard shows only assigned cases for regular admins
- Super Admin / Master Admin see all cases on dashboard + list pages
- /surrogates, /intended-parents, /journeys default to 'all' for super/master, 'mine' for others

Data Cleanup:
- Selective cleanup keeping journeys 15,18 + surrogate 35 + IP 43
- Cleared expenses, insurance, psych tracking, referral bonuses, e-sign, admin notes
- Cleared non-kept auth users (accidentally included admins — lesson learned)

Bot Protection:
- Disabled rapid-fill detection (Safari mobile false positive)
- Only time check (15s min) remains active

Other:
- Surrogate admin notification email now includes "How They Heard" with referral name
- IP_STAGES separated from SURROGATE_STAGES in constants

**Next steps:**
- Build Gmail inbox integration on case Emails tab (pull unread emails from case contacts)
- Unread indicator (flashing dot) on Emails tab

**Open questions:**
- None

## 2026-04-10 (E-Sign Polish, Records Summary, HIPAA Releases, Past Calendar Events)

**Worked on:** E-signature initials/optional field fixes, portal Documents visibility, GC Application reorg, Clinic & Hospital provider rebuild, HIPAA medical records release generation + batch signing, fax integration with cover page, Resend transactional emails, application review workflow, referral & bonus tracker, date_completed checklist step, Records Summary workspace, past calendar events with edit/delete + confirmation dialog.

**Changes made:**

E-Signature:
- Initials use Dancing Script font (replaceAllText then updateTextStyle)
- Drawn initials uploaded as images and inserted via insertInlineImage (like signatures)
- Support for Initials/Initials2/Signature2-5/checkbox2 placeholders
- Optional field cleanup pass scans for remaining `{{...}}`
- Audit trail rendered as separate canvas page in PDF (html2canvas + jsPDF direct)

Portal Documents:
- Surrogates/IPs see only e-signed documents and what they uploaded
- Uploaded docs visible on case Documents tab

GC Application Reorganization:
- "Application" tab renamed to "Personal Information"
- Sections reordered, References gets admin-only reference notes
- Confidential section displays Driver's License via PhotoIdDisplay component
- Photo ID labeled per uploader (GC/IP1/IP2/Partner)

Clinic & Hospital (Medical Records Release purpose):
- Rebuilt with per-pregnancy provider details (OB, hospital, MFM, etc.)
- GenerateReleaseFormsButton with selectable providers

HIPAA Medical Records Release:
- `releaseFormGenerator.js` — fax-friendly HTML release per provider
- Batch signing flow at `SignReleaseBatchPage.jsx` — one link, one verification
- Branded verify page matching login

Fax Integration:
- Custom branded cover page generator
- Fixed `sendFax()` dropping `additionalFiles` (was destructuring specific params)
- Fax dialog from case documents with DL attachment + signature block

Resend Transactional Emails:
- `welcome-email.js`, `reinvite.js`, `reset-password-email.js`, `notify-new-application.js`
- Notification email includes "How They Heard" with referral name / other text
- Reset password handles multiple Supabase response formats (action_link/hashed_token)

Application Review Workflow:
- "Mark as Reviewed" button updates dashboard

Referral & Bonus Tracker:
- `ReferralBonusTrackerPage.jsx` — $4K default, split payments at medical/legal clearance

Checklist:
- New `date_completed` step type with direct Complete button (TrackingTable.jsx)

Records Summary Workspace:
- `RecordsSummaryWorkspace.jsx` — split-screen docs left, form right
- PDF merge + page removal tools, preview modal with match-sheet styling
- forwardRef + useImperativeHandle exposes form data for live preview
- Pre-fills from Supabase `surrogate_profiles` (not localStorage)
- Pregnancy banner with inline pills (outcome, date, GA, weight, sex, delivery)
- New `records_admin` role added to constants
- Records Summary nav item under Operations

Past Calendar Events (CaseCalendarWidget):
- Loads 2 years back + 6 months forward
- Split into upcomingEvents / pastEvents
- "X past" button opens modal listing all past appointments
- New EventRow reusable component (used in upcoming + past)
- Added in-app delete confirmation dialog (replaced browser confirm)
- Fixed `handleCreate` to tag events with `extendedProperties.private.caseId`
- Fixed `confirmDelete` to try both `defaultCalId` and `'primary'` calendars
- Fixed `handleEdit` to try both `defaultCalId` and `'primary'` calendars (matches delete fix)

**Next steps:**
- Test edit flow on production for events on the appointments calendar
- Continue with Match-Centric Case Architecture plan (`~/.claude/plans/goofy-waddling-dawn.md`)

**Open questions:**
- None blocking

## 2026-04-10 (Floating Sticky Notes + Bot Protection Fixes + UI Polish)

**Worked on:** Draggable floating sticky notes, removed dashboard calculator/sticky notes, Couple/Single badge cleanup, bot protection adjustments for Safari mobile, surrogate notification email enhancements

**Changes made:**

Floating Sticky Notes:
- New FloatingStickyNotes component with draggable, persistent post-it notes
- 5 colors (yellow, pink, blue, green, purple) with paper fold effect
- Click to edit, click away to save
- Minimize button shrinks notes to small pills in TopBar (right after calendar icon via React portal)
- Per-user persistence in Supabase app_config (each admin has their own notes)
- Admin-only feature, renders on all pages via AppLayout
- Removed old dashboard calculator and sticky notes (replaced by floating version)

UI Cleanup:
- Removed Couple/Single parent badge from IP cards (list, detail, hero)
- Removed Type column from IP list view table
- Names already indicate couple status (e.g., "Sam & Alex Jones")
- Pluralization on journey pages kept ("Intended Parent" vs "Intended Parents")

Bot Protection (Safari mobile fixes):
- Disabled rapid-fill detection (Safari mobile false positive)
- Honeypot, Turnstile already disabled
- Only time check (15s minimum) remains active
- Real surrogates can now submit without being silently DQ'd

Email Notifications:
- Surrogate admin notification email now includes "How They Heard" section
- "Friend or family" shows referrer name
- "Other" shows custom text
- Standard sources show as-is

**Next steps:**
- Test sticky notes on production
- Continue with whatever Julie wants next

**Open questions:**
- None — all features working as intended

## 2026-04-09 — 2026-04-10 (Psych Tracking, Birth Logging, IP Profile Builder)

**Worked on:** Editable checklist dates for case imports, Psych Tracking page with shareable external link, pregnancy tracker birth logging, baby images, IP portal redesign, IP profile builder

**Changes made:**

Checklist log dates editable:
- New log entries: date picker (defaults to today, supports past dates for case imports)
- Editing existing entries: date is now an editable date input instead of read-only
- Works across all checklists (surrogate, IP, journey)

Psych Tracking page (`/psych-tracking`):
- New page under Operations between Insurance Tracking and Expense Tracking
- Renamed "Insurance" → "Insurance Tracking" in sidebar
- Auto-populates surrogates with active pregnancy tracker (`pregnant === 'yes'`)
- Manual "+ Add Surrogate" entry via modal (name, email, phone)
- Columns: Surrogate, Contact (email + phone stacked), Due Date, 10 Week (Due/Completed), 20 Week (Due/Completed), 30 Week (Due/Completed), Delivery Date, Post Delivery
- Gestational milestone dates auto-calculated (due - 280 days + 70/140/210)
- Editable check-in date cells, green when set
- Share Link button generates token-based public URL at `/psych-tracking/share/:token`
- External users can view AND update check-in dates without login
- Both admin and shared views match layout

Pregnancy tracker — Log Birth:
- New "Log Birth" button on pregnancy banner (pre-delivery)
- Dialog: delivery date, type (Vaginal/C-Section variants/VBAC), per-baby name/sex/weight/length, post-delivery notes
- After birth: banner turns amber "Baby Born!", status auto-updates to "Delivered"
- 🤰 emoji replaced with baby-boy.png or baby-girl.png based on first baby's sex
- New "Delivered" step added to pregnancy timeline (amber circle with 🎉)
- "Pregnant!" timeline step colored by baby sex (pink girl, blue boy, green unknown)
- "Edit Birth Details" button after delivery opens full birth form pre-filled
- Baby images replace 🤰 across MatchedJourneysPage and CaseUpdatesPage
- Babies born counter auto-updates: heartbeat → +1 pregnant, birth → -1 pregnant + births for current year, loss → -1 pregnant
- Status dropdown always includes current status even if not in stage's configured list

IP portal redesign:
- IPDashboard rebuilt to match SurrogateDashboard pattern
- Welcome banner, pending tasks badge, "My Intake Answers" card with dialog
- Tasks To Do + Completed sections, coordinator card, contact card
- Removed inline intake form display (now in dialog like surrogate's quiz results)

IP Profile Builder (full rewrite):
- 5 collapsible sections: Fertility, Surrogacy, Personal (per-person), Health (per-person), History (per-person)
- All fields always editable inline (no Edit/Save toggle) with auto-save (2s debounce)
- Layout matches GC profile exactly: progress ring, gradient bar, section cards, "5/6" count format
- IP1/IP2 tabs for per-person sections when partner exists
- Pre-fills from intake quiz answers on first load (frozen embryos, donors, RE doctor, DOB)
- New "Basic Information" section at top with profile photo + cover photo upload
  - Profile photo hint changes based on partner status
  - Cover photo: "favorite picture of you doing something you love"

Other:
- Removed delivery history for journey 14 manually via Supabase

**Next steps:**
- IP photo upload verification
- IP profile preview button
- Admin photo editing for IP profile
- Admin IP profile edit UI matching GC pattern
- Admin IP preview, approve, save PDF

**Open questions:**
- Should manual psych tracking entries be removable from the shared view?
- Birth logging — should it create a journey note automatically?

---

## 2026-04-07 through 2026-04-09 (Major Feature Session)

**Worked on:** Photo management overhaul, profile sharing, surrogate stages, IP portal, bot protection, email notifications, auth fixes, data reset

**Changes made:**

Photos & Profile:
- Unified admin photo grid with crop/rotate/resize editor + inactive toggle
- Photo carousel with lightbox modal on shared profiles
- Cover photo ordering (headshot first), PDF print view fixes
- Fixed photo loading (user_id from surrogate_profiles table)

Stages & Statuses:
- Removed "Matched Journey" from surrogate/IP stages (lives under /journeys)
- Added Holding, Not Qualified, Withdrawn stages with customizable statuses
- "Active Cases" button replaces "Total" (excludes holding/DQ/withdrawn)
- Portal blocking for DQ/withdrawn surrogates via /api/check-portal-access
- Admin confirmation dialog when moving case to DQ/withdrawn

IP Portal (NEW):
- Both IPs can be invited (primary + partner) from admin detail page
- findCaseByEmail() helper matches primary OR partner ip2Email
- Both IPs share same case data (documents, forms, dashboard)
- Real IP Dashboard replacing mock (case info, coordinator, links)
- IP Profile page (read-only view of case info)
- ProfileRouter directs IPs vs surrogates to correct profile page

Emails:
- IP welcome email on quiz submit (branded, 48hr response timeline)
- IP admin notification with all intake answers
- Separate IP_APPLICATION_NOTIFY_EMAIL env var
- Fixed surrogate welcome email (no longer pre-creates auth user)

Auth & Portal:
- Fixed "already registered" error (confirmation page signUp is single source of truth)
- New /api/set-password endpoint for users who were admin-invited
- Auth redirect to /login when not authenticated
- Portal access check supports both surrogate and IP cases

Bot Protection:
- Fixed Safari mobile DQ (honeypot autofill + Turnstile blocking)
- Disabled honeypot and Turnstile, kept time check + rapid-fill
- Phone number auto-formatting (xxx-xxx-xxxx) on surrogate + IP forms
- Country code selector on IP phone fields

Intake Form Updates:
- Added "6+ deliveries" and "2+ C-sections" DQ questions
- "Friend or family" referral requires name
- Default assignment to intake@abcsurrogacy.com for qualified surrogates

Application Flow:
- Reopen application for updates (admin button, in-app dialog)
- Auto-task on application submit (Review Application, high priority)
- Checklist "app_complete" step auto-set to "Reviewing" on submit
- Profile lock when approved (sections collapse, not editable)

Admin Dashboard:
- Task case names with clickable links
- Fixed case_type mismatch (gc → surrogate normalization)
- Last login date on surrogate cards (batch API)
- Admin confidential form simplified to match portal

Data:
- Full data reset script (cleared all test data, kept config)
- Reset ID sequence for fresh start

**Next steps:**
- Draggable sticky notes (floating, persistent, minimizable to top bar)
- Fix Resend email notifications (shared profile questions)
- IP application forms (if needed beyond intake quiz)
- Text API integration (Twilio)

**Open questions:**
- Resend API key may need reconfiguring for some email flows
- IP_APPLICATION_NOTIFY_EMAIL needs to be set in Cloudflare env vars

## 2026-04-09 (Continued — Records Summary, Checklist Date Completed, UI Polish)

**Worked on:** Records Summary feature (split-screen workspace), PDF merge/page removal tools, checklist Date Completed type, preview/export PDF, UI polish

**Changes made:**

Records Summary Feature:
- Records Admin role added to constants
- Records Summary list page (/records-summary) — shows surrogates with "Records Summary" checklist = Requested
- Split-screen workspace (/records-summary/:id):
  - Left panel: document viewer with inline PDF preview, merge PDFs, remove pages
  - Right panel: GC Medical Records Summary form matching the docx template
  - Pre-fills from Supabase surrogate profile (not localStorage)
  - Sections: General Info, Social History, COVID, GYN, Obstetrical History, Labs, OB Clearance
  - Per-pregnancy sections auto-generated from profile pregnancy count
  - Miscarriage with no prenatal care = notes-only box
  - Labs table with 14 defaults + add custom rows
  - Saves to app_config per surrogate
- Preview modal with match-sheet styling (condensed grids, navy accents)
- Pregnancy headers: G1 banner with inline pills (outcome, date MM/DD/YYYY, GA, weight, sex, delivery type)
- Export to PDF via html2canvas + jsPDF
- Horizontal ABC logo (no URL version) for header

PDF Tools (in document panel):
- Merge: select multiple PDFs → combine into one via pdf-lib
- Page removal: click page numbers to select → remove from PDF
- Original auto-backed up as "[Original] filename.pdf" before changes

Checklist:
- "Date Completed" step type added to Settings dropdown
- Direct "Complete" button on checklist rows for date_completed type
- Shows "Completed MM/DD/YYYY" in green after clicking

Other:
- Psych Tracking nav item added (by user)
- IP Detail page stage selector updated (by user)
- Portal blocked state on login page (by user)

**Next steps:**
- Continue refining Records Summary UI/UX
- Wire up "Mark Complete" button to update checklist step
- Add ability for Records Admin to only see Records Summary page
- Build PDF export with proper page breaks for multi-page summaries
- Consider adding document annotations/notes per page

**Open questions:**
- None currently

---

## 2026-04-07 through 2026-04-09 (Surrogate Portal, Medical Records Releases, Faxing, Auto-Emails, Application Workflow)

**Worked on:** Surrogate portal application forms, HIPAA medical records release system, fax integration with branded cover pages, Resend transactional emails, application review workflow, referral/bonus tracker updates, checklist improvements

**Changes made:**

Surrogate Portal Application System:
- Release Application flow: admin button → surrogate sees forms on dashboard
- 5 form sections: Personal Info, Confidential, References, Clinic/Hospital, Social Media Release
- All fields required with phone formatting (xxx-xxx-xxxx), email validation
- Insurance fields conditional on "Do you have health insurance?"
- Spouse/partner fields conditional on "Do you have a spouse/partner?"
- Pre-fills from quiz data (name, DOB, marital status)
- Accordion behavior: save collapses section, opens next
- Submit Application modal auto-pops when all complete
- Read-only after submission, admin sees status on case hero
- Driver's License upload for GC + Partner (stored with doc_label)

Clinic & Hospital Form (rebuilt):
- Pre-fills pregnancy count from profile
- Per-pregnancy: outcome, prenatal care, delivery hospital, MFM, IVF
- Non-delivery outcomes ask about prenatal care, skip if none
- "Did you use IVF or other third-party reproductive assistance?"
- Experienced surrogate pre-fills from profile

HIPAA Medical Records Release Forms:
- Generated per unique provider from clinic/hospital data
- HIPAA compliant (45 CFR 164.508, 42 CFR Part 2, Cal. Civil Code 56.11)
- Fax-friendly: black/white, no colored backgrounds
- Batch signing page: one email, one link, verify once, sign all
- PDF generation via html2canvas + jsPDF (page 1: form, page 2: audit trail)
- Signed PDFs auto-filed to case_documents
- Admin can select which providers to generate
- Email logged to case_emails with provider list

Fax Integration (from case Documents tab):
- Custom branded cover page (ABC logo, sender's Gmail signature)
- Pre-filled subject/body for medical records requests
- Driver's license attachment option (auto-finds GC-labeled photo ID)
- SRFax API with multi-file support
- Fax sends logged to case_emails with tag 'fax'

Resend Transactional Emails:
- Welcome email: "We received your surrogate quiz!" with Set Password button
- Reinvite email: "Welcome to your secure portal" (for existing users)
- Reset password email: branded with gradient button
- New application notification: sends to configurable admin list (GC_APPLICATION_NOTIFY_EMAIL)
- All from noreply@abcsurrogacy.com via Resend

Application Review Workflow:
- "Mark as Reviewed" button on intake applications page
- Logs reviewer name + timestamp
- Surrogate dashboard: green "We've reviewed your quiz results!" banner
- Quiz Results card hidden after review
- Simplified status buttons: Qualified / Rejected only
- Quiz detail view updated to show actual quiz fields

Other:
- Portal Documents page (surrogate can view signed docs + upload)
- Admin notes connected to Supabase (was in-memory only)
- ZenQuotes proxied through Cloudflare Function (CORS fix)
- AI Summary button added to all case/journey hero sections
- Auto-assign qualified surrogates to intake@abcsurrogacy.com
- Referral & Bonus tracker: $4,000 defaults, split payments at medical/legal clearance
- "Date Completed" checklist step type with one-click Complete button
- Appointments hidden from portal (temporarily)

**Next steps:**
- Build Records Summary feature (split-screen doc viewer + summary form)
- Create "Records Admin" user role with limited access
- PDF merge/page removal tools for medical records
- Pre-fill summary template from pregnancy profile data
- Labs table with configurable rows
- Export completed summary as PDF

**Open questions:**
- None — all Records Summary requirements clarified

---

## 2026-04-06 (Continued #2 — E-Sign Fixes, Match Sheet Emails, Baby Details, Partner Prefill)

**Worked on:** E-signature signed PDF fixes, match sheet email templates, baby sex/name tracking, partner auto-fill, document overflow, compose paragraph spacing

**Changes made:**

E-Signature Signed PDF Fixes:
- Signed PDF now uses working draft copy (not original template) — preserves admin edits
- matchCase: true on replaceAllText to prevent accidental content corruption
- Initials use actual typed values (not computed from name which gave "13" for "10 36")
- fieldValues saved on signer record for PDF generation
- findTextInDoc now searches across multiple text runs (fixes split formatting)
- Draft copy kept until signing complete, then auto-deleted
- Added OptionalInitials/OptionalText placeholder types (not required)
- Document overflow CSS: reset Google Docs margins, max-width constraints

Match Sheet Email Templates:
- Attorney: picker dialog (IP Attorney vs GC Attorney), prefills To email
- Escrow: To=info@seedtrustescrow.com, CC=IPs, SeedTrust intro template
- Clinic: To=3rd party coordinator, case manager intro template
- Fixed openDraft ignoring body param for new messages
- Compose editor paragraph spacing via ProseMirror CSS

Baby Details:
- Baby sex tracking (boy/girl/unknown) in heartbeat confirmation + edit dialog
- Baby name field per baby
- Pregnancy banner shows "👧 Emma, 👦 James" format

Partner Auto-Fill:
- E-sign pulls partner name/email from _confidential section
- Partner only added as signer when document has {{*:Partner}} placeholders
- Role dropdown auto-fills name/email for all roles (Surrogate, IP1, IP2, Partner)
- Prefill from case page now scans document for required roles first

Other:
- Removed spouse/partner email from Application section (lives in Confidential only)
- fetchSurrogatesFromIntake includes answers object + confidential partner data

**Next steps:**
- Fix {{Text:GC}} being replaced with signer name (should use actual typed value)
- Initials as drawn/typed signature pad (not text input)
- More email templates (waiting for ABC's attorney template)
- Auto-attach GC psych report to clinic match sheet
- Test signed PDF end-to-end with real data

**Open questions:**
- Should {{Text:GC}} contain custom text or default to signer name?
- Initials pad: same size as signature or smaller?
- Should Optional fields show differently on signed PDF vs just being blank?

---

## 2026-04-06 (Continued — E-Sign Templates, Email Templates, Calendar Picker, Dashboard Fix)

**Worked on:** E-sign template preservation, email templates with auto-welcome, calendar picker for multiple calendars, dashboard appointment fixes

**Changes made:**

E-Signature Template Preservation:
- Copies template into "ABC Drafts" folder before editing (original untouched)
- Draft auto-deleted from Google Drive after successful send
- Added getOrCreateDraftsFolder() + deleteGoogleDriveFile() helpers
- ABC Drafts folder hidden from template list (separate from ABC Templates)

Email Templates:
- /api/welcome-email Cloudflare Function: auto-sends branded welcome to qualified surrogates
- Creates portal account + includes "Set Up Your Portal Password" button
- Triggered automatically on quiz qualification (non-blocking)
- Uses Resend API (needs RESEND_API_KEY + domain verification)
- 5 templates: GC Welcome, GC Screening Scheduled, GC Profile Reminder, IP Welcome, Match Introduction
- emailTemplates.js: template definitions + mergeTemplate() for field replacement
- "Send Template" button on case Emails tab → pick template → preview → Open in Compose

Calendar Picker:
- Loads user's writable Google Calendars
- Auto-defaults to "Appointments" calendar if exists
- Calendar dropdown when creating appointments
- Events fetched from both primary + Appointments calendar, deduped

Dashboard Appointments Fix:
- Searches both primary + Appointments calendar (was only primary)
- Shows from start of today (not yesterday)
- Shows case name as clickable link on each appointment

**Next steps:**
- Set up Resend: add RESEND_API_KEY to Cloudflare, verify abcsurrogacy.com domain
- Add email preview page for testing templates
- More email templates as needed
- Consider adding "Preview" button to Send Template dialog

**Open questions:**
- Resend vs Gmail API for welcome emails (Resend chosen for branded from address)
- Should auto-welcome also trigger for IPs?

---

## 2026-04-06 (Email UI, Compose Fix, Auto-Logout, Personal Tasks, Pregnancy Tracker Polish)

**Worked on:** Email compose case selector fix, CaseEmailsTab improvements, auto-logout on inactivity, personal dashboard tasks, pregnancy tracker refinements, login routing

**Changes made:**

Email Compose — Case Selector Fix:
- Fixed "GC: undefined" / "IP: undefined" — was using .applicant_name instead of .name/.names
- Cases grouped by type: Journeys (IP + GC names), Surrogates, Intended Parents
- Wider dropdown (180px), section headers

CaseEmailsTab Improvements:
- Click email subject to open full email (removed external link icon button)
- Sent/Received badges (blue/green) based on from_address matching current user
- Tag selection on Log to Case dialog: selected tag turns indigo with ring glow + scale

Auto-Logout on Inactivity:
- Admins: 6 hours, Users: 1 hour
- Tracks mouse, keyboard, scroll, touch — resets timer on any activity
- Redirects to /login?reason=idle with amber message
- Built into RoleContext (runs whenever authUser is set)

Login Routing:
- Root URL (/) now shows login page instead of Coming Soon
- /welcome also routes to login
- After login redirects to /dashboard (was / which looped)

Personal Dashboard Tasks:
- "+ Add Task" button on My Tasks section
- Dialog: title, due date, priority, notes
- Saved with case_type='personal', no case_id
- "Personal" vs "Case" badges on task list

Pregnancy Tracker Polish (from 2026-04-05 continued):
- Status auto-updates to "Pregnant" on heartbeat confirmation
- Transfer tabs: Transfer #3 | #2 | #1 (newest first, compact)
- Edit transfer: full form with beta, beta #2, heartbeat, babies, dropped cycle
- Delete transfer: system dialog (not browser confirm)
- Beta: forced Yes/No for second beta (no default), beta value field
- Beta HCG #2: extra timeline step when needed
- Heartbeat: number of babies field
- Pregnancy loss: miscarriage/ectopic/chemical/other — logs on transfer, clears status
- Mark Unsuccessful button, Dropped Cycle option
- 🤰 emoji on pregnancy banner (tried several custom images, settled on emoji)
- Pink belly line art icon on /journeys cards
- Removed GC insurance label from GC card, bigger attorney font
- Sticky notes on GC and IP cards (shared across all users via app_config)
- Confetti uses same dramatic settings as surrogate quiz (260 particles, ABC colors)

Dashboard Build Fix:
- Fixed IIFE syntax error in JSX from other session's calendar changes

**Next steps:**
- Customizable checklist log types: Status Dropdown (default), Text Field, Custom Dropdown, Database Lookup
- System/locked checklist steps with database lookups (IVF Clinic, OB Doctor, etc.)
- Step deactivation per case (already works via "Deactivate" status)
- Determine which steps need database lookup sources

**Open questions:**
- Which checklist steps need database lookup? (waiting for user to specify)
- Should locked/system steps be visually different in Settings?
- Checklist log type for each existing step needs to be defined

---

## 2026-04-05 (User Invites, Dynamic Admin Users, Password Reset, Login Branding)

**Worked on:** User invite system, dynamic admin users from Supabase Auth, password reset flow, login page branding, invite bug fixes

**Changes made:**

User Invite System:
- /api/invite Cloudflare Function: creates Supabase auth user + generates password reset link
- /api/user-status Function: checks if user has account + last login date
- /api/admin-users Function: lists all admin users from Supabase Auth
- Branded invite email via Gmail API (logo, gradient button, personalized greeting)
- "Invite to Portal" button on Surrogate and IP detail pages
- Auto-invite when adding admin from Settings → Team Management
- Invite date logged per case (_lastInvitedAt stored in answers via direct Supabase query by ID)
- Portal status: shows "Portal Active" + last login when user has set password
- Invite button hidden once user has logged in

Dynamic Admin Users (replaces hardcoded mockUsers):
- /api/admin-users returns admin/master_admin/super_admin users from Supabase Auth
- mockUsers array populated on app load via loadAdminUsers()
- getAdminStaff() function replaces all module-level ADMIN_STAFF constants
- Updated 11+ files to use getAdminStaff() instead of static constants
- 3-second timeout fallback if API is slow
- Marketing role excluded from admin dropdowns
- Removed all hardcoded fallback users

Password Reset:
- Forgot password flow on login page (Supabase resetPasswordForEmail)
- /reset-password page with branded UI matching login
- Expired link detection with friendly message
- Redirect URL config needed in Supabase

Login Page Branding:
- Gradient background (indigo → cream → pink)
- "Welcome back" with pink accent
- Frosted glass card, pink-to-indigo gradient button
- Removed surrogate quiz link

Bug Fixes:
- Fixed invite wiping case data (was using fetchIntakeByEmail which returned wrong format; now uses direct Supabase query by ID)
- Fixed IPTileCard crash (missing getAdminStaff import)
- Fixed Cloudflare Functions using @supabase/supabase-js SDK (rewrote to raw fetch)
- Fixed invite reset link missing /reset-password redirect

**Next steps:**
- Email templates (predefined with merge fields)
- Admin invite from Settings needs to persist to Supabase (currently only local state + auth)
- Consider storing admin users in a Supabase table instead of just auth.users
- Test invite flow end-to-end on production

**Open questions:**
- Should admin team members be stored in a dedicated table or just auth.users?
- Email templates: what templates are needed first?
- Should we add a "Resend Invite" button for surrogates/IPs who haven't set their password?

---

## 2026-04-04 (Password Reset, Login Brand, List Redesigns, AI Extraction, Email CSS)

**Worked on:** Password reset flow, branded login page, IP/Journey list redesigns, AI expense/task extraction fixes, email CSS isolation, admin user setup

**Changes made:**
- Password reset: forgot password flow on login + /reset-password page (Supabase resetPasswordForEmail)
- Login page: gradient background, "Welcome back" in brand colors, frosted glass card, pink-to-indigo gradient button
- IP list: hero stats, owner filter, pink ping for New, milestones, FertilizedEggIcon, assigned admin
- Journeys list: hero stats, owner filter matching surrogates/IPs pattern
- AI extraction: full email body via Gmail API, improved dollar detection prompt, error surfacing
- Email CSS: sandboxed iframe prevents style leaking (Amazon dark theme fix)
- Expense email viewer: 90vw modal, mail icon links to full email
- Admin setup: desiree@abcsurrogacy.com user created + role fixed via user_metadata
- Removed surrogate quiz link from login

**Next steps:**
- User invite system
- Email templates
- Configure Supabase redirect URL for password reset

---

## 2026-04-04 (Dashboard Redesign, Expense Tracking, Gmail Signature, Documents, Matching, Name Ordering)

**Worked on:** Complete dashboard redesign, expense tracking system, Gmail signature fix, document management for IP/Journey, matching improvements, break match document handling, name ordering (IP first), Case Updates page

**Changes made:**

Gmail Signature Fix:
- Signature rendered as raw HTML below Tiptap editor (not parsed through it)
- Preserves tables, borders, images, animated GIFs exactly like Gmail
- Signature shown in compose preview only, not included in sent body (Gmail auto-appends)
- Fixed MatchSheetsTab userId (was undefined, preventing signature load)

Expense Tracking System:
- /expenses page: Insurance-style spreadsheet with Expenses/Reconciled tabs
- Columns: Case (IP+GC name + manager), Date, Amount, Paid To, CC Last 4, Escrow (Y/N), Notes, Doc, Reconcile
- Currency input: payment terminal style (type 2424 → 24.24)
- Reconcile confirmation modal with case name, "+ Create Task" option
- Task creation from reconcile: assigned to case manager, due today, priority high
- task_created flag on expense persists across sessions (amber warning on re-reconcile)
- Attachment upload + eyeball preview (images inline, PDFs in iframe)
- Journey Expenses tab: inline editable rows (click any cell), add/delete, paperclip upload
- "+ Add Expense" button on journey Escrow section
- Submitted to Escrow Y/N toggle on add expense dialogs
- DB: journey_expenses table CRUD with attachment_url, cc_last4, submitted_to_escrow, task_created

Escrow Section Updates:
- "Close" renamed to "Escrow Close Date", displays MM/DD/YYYY
- Balance update date logged (small gray text)
- All date fields in journey hero now format MM/DD/YYYY via formatDate()

Document Management:
- Real DocumentsTab on IP cases and Journey pages (was empty state)
- Journey Documents merges GC + IP docs with source labels ("GC — Name", "IP — Name")
- Added folders: Escrow, Expenses, Photos
- Renamed "Agency Agreement" to "Agency Documents"
- Removed duplicate Send for Signature / Send Fax buttons on journey
- Break match: copies only journey-period docs (not pre-match), keeps original folder
- "Previous Match" amber badge on copied docs (based on uploaded_by field)
- Labels moved to detail line (below filename) to prevent truncation

Matching Improvements:
- Create Match dropdowns hide already-matched GCs and IPs
- After creating match, navigates to new journey page
- IP names displayed first everywhere (journeys, emails, expenses, case import)

Dashboard Redesign:
- Motivational quote of the day (zenquotes.io API)
- Collapsible Upcoming Appointments (Google Calendar, next 7 days) + My Tasks columns
- My Cases: only assigned cases, separated by type (Journeys, Surrogates, IPs)
- Uses identical card components from actual list pages (JourneyTileCard, SurrogateCard, IPTileCard)
- Grid/list view toggle
- Calculator widget (fully functional)
- Sticky Notes (per-user localStorage, color-coded)
- Removed Surrogate Screening Overview (moved to Case Updates)

New /case-updates Page:
- Surrogate Screening Overview moved here from dashboard
- Stage filter pills, checklist spreadsheet
- Added to nav under Client Management after Matched Journeys

**Next steps:**
- Large file import (Supabase 50MB limit for old system profiles)
- Matching page redesign
- Journey merged Documents tab improvements
- Password reset feature
- User invite system

**Open questions:**
- Supabase storage file size limit — old profiles exceed 50MB
- Should journey documents show source labels differently?
- Expense tracking: should reconciled expenses be editable?

---

## 2026-04-04 (Continued — Email Tags, AI Extraction, IP/Journey List Redesign, Email CSS Fix)

**Worked on:** Email tagging with AI-powered expense/task extraction, IP list page redesign, Journeys list page redesign, email CSS isolation, admin user setup

**Changes made:**

Email Tagging System:
- 13 email tags: Escrow, Expense, Medical Records, Monitoring, OB, Hospital, Legal, Matching, Task, Insurance, Transfer, Psych, General
- Tag selector on Log to Case dialog (pill buttons after case selection)
- Tag dropdown on Compose window (next to case selector for sent emails)
- CaseEmailsTab: tag badges on emails, filter bar by tag, search by subject/from/snippet
- SQL migration: tag column + index on case_emails

AI-Powered Extraction (Cloudflare Function + Claude Haiku):
- /api/ai/extract function calls Anthropic API
- Expense tag: AI reads full email body (6000 chars), extracts description, amount, paid_to, date, category, notes
- Task tag: AI extracts title, description, priority, due_date
- Editable confirmation cards (amber for expense, orange for task) before saving
- Expense: links to email via Gmail ID in notes, viewable from Expenses page mail icon
- Task: defaults assigned_to to current user, admin dropdown to reassign
- Full email body fetched via Gmail API for better extraction (not just snippet)
- Improved AI prompt explicitly searches for dollar amounts ($X.XX patterns)

Expense Page Email Viewer:
- Mail icon on expenses created from emails
- Click opens full email modal (90vw wide, from/to/cc/date/subject/body)
- Fetches live from Gmail API

Email CSS Isolation:
- Email HTML rendered in sandboxed iframe (was dangerouslySetInnerHTML)
- Prevents email CSS (e.g. Amazon dark theme) from leaking into app sidebar/nav

IP List Page Redesign:
- Hero stat boxes (Total + 6 stages) — clickable to filter
- Owner filter: My Cases / All / Unassigned / per-admin
- Blinking pink dot on "New" IP cases
- Milestone progress bar on cards
- FertilizedEggIcon for frozen embryos
- Assigned admin shown on cards
- Removed: "Submitted" date, "View Case" hover
- StageBadge replaces StatusBadge

Journeys List Page Redesign:
- Hero stat boxes (Total + 3 journey stages) — clickable to filter
- Owner filter: My Journeys / All / Unassigned / per-admin
- Stage counts update based on owner filter
- Cards unchanged

Admin User Setup:
- Created Supabase auth user for desiree@abcsurrogacy.com
- Fixed role assignment via user_metadata (defaults to surrogate without it)

**Next steps:**
- Password reset feature
- User invite system (for manually added users)
- Email templates
- Merged Documents tab on journey
- Default owner filter for surrogates page (master/super → all, admin → mine)

**Open questions:**
- Password reset: use Supabase built-in magic link or custom reset flow?
- User invite: send email with temp password or magic link?
- Email templates: predefined templates or free-form with merge fields?

---

## 2026-04-04 (E-Sign Security, Signature Fix, Case Tasks, Case Calendar, Email Tags Planning)

**Worked on:** Secure e-signature URLs, typed signature fix, case tasks system, case calendar with Google Calendar API integration, calendar page link improvements

**Changes made:**

E-Signature Security:
- Added signing_token column (64-char hex, crypto.getRandomValues) to esign_documents
- New route /e-signature/sign/:token for secure signing URLs
- fetchDocumentByToken() in esign.js
- EditDocumentPage sends token-based URLs in emails
- Legacy /e-signature/:id route kept for backwards compatibility
- SQL migration: scripts/esign-token-migration.sql

Typed Signature Fix:
- mouseup handler was firing in typed mode, overwriting typed value with blank canvas
- Added modeRef to track current mode in event handler closure
- Switching modes now resets signature value properly
- Typed onChange explicitly sets image: null to clear stale drawn data

Case Tasks System:
- New Supabase table: case_tasks (id, case_id, case_type, title, description, status, priority, due_date, assigned_to, created_by, completed_at/by)
- CaseTasksWidget: add tasks, cycle status (open→in_progress→complete), expand for notes, delete, overdue highlighting, completed section
- DashboardTasksWidget: "My Tasks" on admin dashboard with cross-case view, searchable case picker for adding tasks
- DB helpers: fetchCaseTasks, fetchMyTasks, fetchAllOpenTasks, createCaseTask, updateCaseTask, deleteCaseTask
- Added to Overview tab on Surrogate, IP, and Journey detail pages (below milestones)

Case Calendar Widget:
- CaseCalendarWidget shows appointments for a specific case using Google Calendar API
- Events tagged with extendedProperties.private.caseId for per-case filtering
- listCaseEvents() in google.js uses privateExtendedProperty filter
- Events created from a case appear on full Google Calendar automatically
- Add Appointment dialog: title, date, time/all-day, notes
- Event title format: "Appointment — Client Name"
- Event description: client name + case URL (Google auto-links it)
- Calendar page (/calendar): URLs in event popup are now clickable internal links
- Case widget: shows title only (no redundant link since already on the case)
- Two-column layout: Calendar (left) + Tasks (right), below milestones

Other Fixes:
- Insurance modal widened to max-w-4xl on journey page
- Insurance page: Pay Status column (PAID/UNPAID) frozen with name column
- Removed hyperlinks from GC/IP names in journey hero (since cases redirect to journey)
- Email compose: openDraft made synchronous to prevent blank page crashes
- Error boundary around ComposeWindows
- Fixed SelectItem empty string value crash
- Fixed Supabase insert .catch() crash

**Next steps:**
- Email tagging system: add tag selector to "Log to Case" dialog
- Tags: Escrow, Expense, Medical Records, Monitoring, OB, Hospital, Legal, Matching, Task
- AI-powered expense extraction from tagged "Expense" emails
- AI-powered task creation from tagged "Task" emails
- Tag-based filtering on case/journey email log
- Supabase migration: add tag column to case_emails table
- Merged Documents tab on journey (fetch from GC + IP + Journey)
- Expense tracking page buildout

**Open questions:**
- Which AI model/API to use for email parsing (Claude API via Cloudflare function?)
- Should expense logs go in a new table or extend an existing one?
- Should AI-generated tasks/expenses require confirmation before saving? (User said yes)
- Email tag storage: single tag per email or multiple tags?

---

## 2026-04-03 (Match-Centric Architecture, Journey Hero Redesign, Insurance, Attorneys)

**Worked on:** Complete journey detail page redesign, match-centric case architecture, attorney info, insurance tab, draggable tabs, provider modals, email compose fixes, checklist history, break match improvements

**Changes made:**

Journey Hero — 3-Card Layout:
- Journey Info (white, 60% left) + GC (pink, stacked right) + IP (blue, stacked right)
- Journey card: Stage with Milestone icon + status pill, escrow section, providers section (3 clickable cards → modal editors), managers at bottom, match date + break match top-right
- GC/IP cards: avatar (md), name (text-base black), age/marital/address flips, Text/Email/Call buttons top-right, insurance badge, attorney row
- Provider modals: Fertility Clinic (name, doctor, address broken out, coordinator + email, website), OB Clinic (name, doctor, phone, address, website), Hospital (name, phone, address, website)
- Pregnancy info only shows for Active Pregnancy status and beyond
- Email/Text confirmation toasts positioned near the card that triggered them
- SMS dialog for texting from journey page (Twilio)

Attorney Info:
- Editable attorney fields for GC and IP in journey hero (Name, Firm, Email, Phone)
- Click attorney name to edit, "Email Attorney" button (subtle, colored on hover)
- Batched save to prevent race conditions
- Logged to journey case when composing email

Insurance Tab:
- Full insurance management: policy details, payment logging, cancel policy
- Supabase tables: surrogate_insurance + insurance_payments
- Insurance indicator on hero cards, click opens dialog on journey
- Insurance page (/insurance): Pay Status column (PAID green / UNPAID red) frozen with name column

Draggable Tabs:
- SortableTabsList shared component using @dnd-kit
- Overview locked first, all others draggable
- Order persists per-case in Supabase app_config
- Applied to Surrogate, IP, and Journey detail pages

Match-Centric Architecture:
- Matched cases redirect to journey (/surrogates/:id → /journeys/:journeyId)
- Matched GCs/IPs removed from list pages
- Journey gets Application tab (GC/IP sub-tabs with full GCApplicationTab/IPApplicationTab)
- Journey gets full editable Profile tab (GCProfileTab exported from SurrogateDetailPage, IPProfileTab)
- Checklist history: stage change snapshots current checklist, "Previous Checklists" collapsible section
- Enhanced breakMatch(): saves journey data snapshot, partner names, checklist history, notes, copies documents to both cases as "previous-match"
- PreviousMatchTab shared component on Surrogate/IP detail pages (only shows if _matchHistory exists)
- Hyperlinks removed from GC/IP names in journey hero

Email Compose Fixes:
- openDraft made synchronous (was async, caused blank page crashes)
- Signature fetched in background and appended when ready
- Error boundary around ComposeWindows prevents app-wide crashes
- Fixed SelectItem empty string value crash in case selector
- Fixed Supabase insert .catch() crash (not a promise)
- Both IP emails shown on separate lines in confirmation

Other:
- FertilizedEggIcon SVG for embryos, EmbryoIcon for IVF clinic
- InsuranceCardIcon SVG
- fmtDate/formatDate helpers for MM/DD/YYYY
- Committed other session's changes (CaseImportPage, xlsx dependency, utils.js formatDate)

**Next steps:**
- Build merged Documents tab on journey (fetch from GC + IP + Journey, label by source)
- Journey-specific tasks system
- Upcoming appointments widget for journey overview
- Expense tracking page
- Matching page redesign
- Checklist history on individual cases (surrogate/IP stage changes)

**Open questions:**
- Should journey documents be a separate Supabase storage bucket or reuse case-documents?
- Expense tracking scope — which roles can view/edit?
- How should journey tasks relate to the dashboard?

---

## 2026-04-03 (Case Import, Insurance Page, Sidebar Redesign, Dark Mode, Date Formatting)

**Worked on:** Case Import page for Super Admin (surrogate + IP with partner, file uploads, matched journey creation with match sheet import), Insurance spreadsheet page, sidebar redesign with liquid glass, centralized date formatting, dark mode (built then hidden)

**Changes made:**

Case Import (src/pages/admin/CaseImportPage.jsx):
- Full case import page at /case-import (Super Admin only)
- Case type: Surrogate or Intended Parent (IP2 partner fields shown inline when IP selected)
- Fields: first/last name, email, phone, state, DOB, application date
- Application date saves as submitted_at on the record + in answers.applicationDate
- File upload zones: Profile PDF, Application PDFs (multiple), Documents ZIP (auto-extracts), Notes Excel (parses Note/Author columns), Photos
- ZIP extraction via jszip (filters __MACOSX, hidden files)
- Excel notes import via xlsx (tries common column names)
- 50MB client-side file size validation (matches Supabase storage limit)
- Success screen with View Case / Import Another buttons

Create Matched Journey section (bottom of Case Import page):
- Searchable surrogate picker + searchable IP picker (type to filter)
- Original match date field + current stage dropdown
- Match Sheet Data import: collapsible accordion with Excel upload OR manual entry
- Excel parser maps ~60 column name variations to _matchSheetData fields (case-insensitive, flexible)
- Supports column-header format and key-value (Field/Value) format
- 29 editable match sheet fields in review grid
- Creates journey via createMatchedJourney, saves match_date + stage + match sheet data
- match_date column added to matched_journeys table (SQL migration)

Insurance Page (src/pages/insurance/InsurancePage.jsx):
- Full spreadsheet-style insurance management
- Surrogates as rows (only those with insurance records), fields as columns
- Columns: State, Status, Year, Carrier, Premium, Due Date, Website, Login, Password, Autopay, Autopay Date, Plan Start, Plan End, Binder Paid, OB, Hospital, Notes
- Per-row password visibility toggle (eyeball icon)
- EditableCell with inline editing (click to edit, Enter to save, Escape to cancel)
- Status dropdown: active_policy, policy_check, open_enrollment, complete
- Year dropdown (current year + 5)
- Dynamic tabs: Active Policies + status × year combinations
- Search searches across ALL tabs (bypasses status filter), clearable
- Admin filter dropdown populated from assigned case managers
- TabBanner for contextual messages per tab
- Insurance fields added to InsuranceTab.jsx (case-level): status, year, plan dates, binder, OB, hospital, notes
- DB migration: 8 new columns on surrogate_insurance table

Sidebar Redesign (continuing from previous session):
- Added Case Import nav item under Admin section (Upload icon, SUPER_ADMIN only)
- Navigation reorganization finalized

Date Formatting:
- Centralized formatDate(value) in src/lib/utils.js (MM/DD/YYYY)
- Swept across multiple files replacing local formatters
- Pink-styled dropdowns system-wide (select:focus, option:checked)

Dark Mode (built but hidden):
- Full dark mode CSS variables in .dark selector
- Toggle in TopBar (Moon/Sun icon) — removed at user request
- CSS preserved in index.css for future re-enablement
- localStorage persistence (abc_dark_mode)

DB functions updated (src/lib/db.js):
- adminAddSurrogate: now stores applicationDate in answers + uses it for submitted_at
- adminAddIP: same applicationDate handling, already supported IP2 partner fields

**Next steps:**
- Resolve file size limit for large PDF imports (Supabase storage limit is 50MB, old system profiles are larger)
  - Options: bump Supabase plan limit, or compress PDFs before upload
- Test full Case Import → Create Matched Journey flow end-to-end
- Test match sheet data appearing correctly on journey Match Sheets tab
- Build out Expense Tracking page
- Matching page redesign (user mentioned coming back to this)

**Open questions:**
- Supabase storage file size limit — user's old profiles exceed 50MB. Need Pro plan or compression
- Should application date show differently from submitted_at on the case list/detail pages?
- Expense Tracking scope and visibility (which roles?)

---

## 2026-04-03 (Journey Hero, Insurance, Attorneys, Draggable Tabs)

**Worked on:** Journey Detail page hero overhaul, attorney info, insurance tab, draggable tabs, hero UX fixes

**Changes made:**
- Attorney info for GC/IP in journey hero (editable, Email Attorney button, logged to case)
- Insurance Tab: policy details, payment logging, cancel policy (Supabase tables: surrogate_insurance + insurance_payments)
- Insurance indicator on hero cards (green icon, click opens dialog on journey)
- Draggable tabs (SortableTabsList) on Surrogate, IP, Journey pages — order saved per-case in Supabase
- Journey hero UX: Milestone icon in stage color, inline stage/status text, pregnancy only for Active Pregnancy+, gestational age large/bold, escrow closing date, clinics on own row
- GC/IP card fixes: age→DOB flip (MM/DD/YYYY), marital→partner flip, home→address flip, Text opens SMS dialog, IP shows both ages/DOBs/phones, FertilizedEggIcon for embryos

**Next steps:**
- Major layout redesign: 3-card hero (Journey purple | GC pink | IP blue) + persistent sidebar
- Journey-specific tasks, milestones as overview default, upcoming appointments, pinned notes, expenses
- Embryo transfer info, doctor appointments (future)
- Insurance dashboard page (future)

---

## 2026-04-03 (Complete Sidebar Redesign)

**Worked on:** Full sidebar navigation redesign — white background, liquid glass active state, icon updates, dock magnification, top bar cleanup, nav reorganization

**Changes made:**

Sidebar Design (src/components/layout/Sidebar.jsx, src/index.css):
- White background replacing old purple-pink glassmorphism gradient
- Liquid glass active state with ABC dot colors (green, blue, orange, pink) shimmer animation
- Dock magnification: hovered nav items scale up 15% with springy easing
- Section headers in indigo blue, pink solid line dividers
- Collapsible sidebar: click logo to toggle (full logo ↔ buggy icon)
- Subtle hover background tint + icon scale pop on nav items
- Logo enlarged (h-12 → h-16)
- CSS sidebar variables updated for white theme

Top Bar (src/components/layout/TopBar.jsx):
- Removed "Home" quick link
- Icon-only display (no text labels) for Email, Texts, Calendar
- Liquid glass active state matching sidebar
- Magnify on hover (120% scale)
- Text Messages uses MessagesSquare (two-bubble) icon

Navigation Reorganization (src/lib/navigation.js):
- New "Inbox" section (above Client Management): Email, Text Message, Fax
- Moved E-Signature from Forms & Documents to Operations
- Added Insurance placeholder to Operations
- Added Expense Tracking placeholder to Operations (for CC transaction logging by case managers)
- Hidden stubs: Forms, Documents, Messages, HR Management, Time Clock, Payroll, Finance (Financials/Reports)
- Kept: Intake/Applications, Marketing/Analytics, Admin/Settings

Icon Updates:
- Surrogates: Heart, Intended Parents: HeartHandshake, Matching: Puzzle, Matched Journeys: Route
- Messages: MessageCircle, E-Signature: PenLine, Payroll: Wallet
- Text Messages: MessagesSquare (two bubbles)
- Insurance: ShieldCheck, Expense Tracking: CreditCard
- Dashboard stat cards updated to match sidebar icons

New Files:
- public/abc-buggy.png — collapsed sidebar logo
- public/icons/matching.png, surrogate.png — unused ChatGPT-generated icons (kept for reference)
- src/components/layout/NavIcons.jsx — custom icon map (currently empty, all using lucide)

**Next steps:**
- Build Insurance page/feature
- Build Expense Tracking page (CC transaction logging, case-linked, admin-visible)
- Consider adding Calendar to sidebar or keeping it top-bar only
- Build out stub pages for new Operations items

**Open questions:**
- Should Expense Tracking be visible to all admins or just master_admin+?
- Insurance page scope: tracking surrogate insurance policies? Or broader?
- Should Calendar get its own sidebar section or stay top-bar only?

---

## 2026-04-03 (Match Sheets, Email Integration, Sidebar Redesign)

**Worked on:** Match Sheets feature for matched journeys (Attorney, Escrow, Clinic), email compose integration with auto-logging, glassmorphism sidebar redesign

**Changes made:**

Match Sheets (src/components/journeys/MatchSheetsTab.jsx):
- Attorney Match Sheet: header with logo/title/case manager, IP section (demographics, embryo creation with dropdown options), Surrogate section (demographics, spouse/partner, details), Journey Details (escrow, terms, psych), IVF Physician, Delivery Hospital
- Escrow Match Sheet: simplified layout — IP info, Surrogate info, Escrow Details (opening amount $5k, minimum $10k, fund after legal $100k)
- Clinic Match Sheet: IVF details, IP/Surrogate medical info, pregnancy history, fertility, insurance
- Custom EditableValue and EditableSelect components for inline editing
- Custom pink dropdown menus replacing native blue select
- PDF generation with page breaks (Surrogate on page 2, Journey Details on page 3)
- "Save to Documents" + "Send Match Sheet" buttons replacing "Download PDF"
- Send Match Sheet: generates PDF, attaches to email compose, auto-logs to journey
- Email subject format: "Attorney Match Sheet - IP(s) Name(s) with GC Name"
- Branded footer with abcsurrogacy.com banner image, address, phone numbers
- Date format: MM/DD/YYYY with support for MM/DD/YYYY, MM-DD-YYYY, YYYY-MM-DD input
- Custom EmbryoIcon SVG component
- PartyBanner component for major section dividers (IP vs Surrogate vs Journey)
- Defaults: SeedTrust Escrow LLC, Max Counseling Sessions 15

Email Integration:
- Journey page: confirmation toast before emailing ("Email Nik L? email@...") with Confirm/Cancel
- Prevents accidental emailing wrong party (GC vs IP)
- IP page: email dropdown with both IP names, combines both emails in To field
- Surrogate page: added caseId to openDraft for auto-logging
- DraftContext: accepts caseType and initial attachments
- ComposeWindows: auto-loads cases when caseId pre-set, inserts email log directly
- Fixed crash-proof openDraft with triple try/catch for signature fetch

Sidebar Redesign (src/components/layout/Sidebar.jsx):
- Glassmorphism design: indigo → purple → pink gradient background
- Frosted glass active state with backdrop-blur and white border
- White logo area for clear branding
- Translucent badges and section headers
- Mobile sheet matches desktop styling

Other:
- Renamed "Benefit Package" folder to "Clinic" in surrogate documents
- Added phone numbers to admin mock users (src/data/mock/users.js)
- Fixed Desiree's email typo in mock users
- TrackingTable shared component: fixed scroll cutoff (overflow-hidden removed)

**Next steps:**
- Build journey Documents tab (duplicate surrogate document UX)
- Clinic Match Sheet needs same updates as Attorney (dropdowns, demographics, etc.)
- Email templates for match sheet emails
- Test PDF page breaks with real data
- Surrogate address/US citizen data may need profile completion

**Open questions:**
- Partner email/phone: currently pulls from profile, should also check intake confidential form fields
- "Previously Been a Surrogate" pulls from pregnancy history — verify data accuracy
- Email auto-logging to journey works but needs testing with real Gmail sends

---

## 2026-04-03 (Fax Integration — Full Build)

**Worked on:** SRFax API live integration, complete fax page UX overhaul with hero stats, table layout, filing workflow with medical records log updates, auto-advance navigation, sidebar badge

**Changes made:**

SRFax Credentials:
- Account number 288185 configured on Cloudflare Pages (SRFAX_ACCESS_ID + SRFAX_ACCESS_PWD)
- API confirmed working — 263 received faxes and 205 sent faxes loaded

Fax Page UX Overhaul (src/pages/fax/FaxPage.jsx):
- Hero stats bar: 4 clickable tiles (Received, Unread, Filed, Sent) with gradient background, act as filters
- Table layout with TrackingTable-style headers (10px uppercase stone-400)
- Received table columns: Fax Number, Document Name, Filed To (case link), Date Filed, Filed By, Log Updated, mark read/unread
- Sent table columns: Fax Number, Status, Pages, Date Faxed, Sent By
- Search by fax number or filed case name
- Mark All Read button
- Click row to preview (auto-marks as read)
- Pink animated dot + "New" badge on unread faxes

Fax Preview Modal:
- Near-fullscreen (95vw × 95vh), scrollable so filing panel can scroll out of view
- Sticky header with prev/next navigation arrows + counter (e.g., "3 / 263")
- "File to Case" button toggles inline filing panel
- Filing panel: rename document, select case type + searchable case selector
- Medical Records Log update: select record + status + note (collapsible section)
- Warning when case has no Medical Records tasks
- Inline amber warning if filing without updating log (Go Back / File Anyway)
- Auto-advance to next unread fax after filing (1.5s delay for success message)
- Closes modal when no more unread faxes

Send Fax Dialog:
- Two modes: Upload File or From Case (pick document from case documents)
- Case type selector (Surrogate/IP/Journey) + searchable case dropdown
- Cover page options (Standard, Company, Urgent, Confidential)
- "Send Fax" button on Surrogate, IP, and Journey Documents tabs

New Files:
- src/lib/faxState.js — localStorage-backed read/unread tracking + filing info (caseType, caseName, caseId, documentName, filedAt, filedBy, logUpdated)
- Updated src/lib/db.js — uploadBase64ToCaseDocuments() with filename sanitization

Sidebar:
- Unread fax count badge (violet) on Fax nav item
- Checks every 2 minutes via listFaxes API

**Next steps:**
- Test medical records log updates end-to-end (verify tracking data persists on case page)
- Add fax number per clinic for quick-send
- Log sent faxes to cases (like email logging)
- Fax delivery status tracking / notifications

**Open questions:**
- Should sent faxes be associated with cases (like email logging)?
- Should there be a default fax number per clinic/case for quick-send?
- Should fax filing data be stored in Supabase instead of localStorage for multi-user?

---

## 2026-04-03 (Fax Integration — Initial)

**Worked on:** SRFax API credentials setup, complete fax page overhaul with send-from-case, received fax preview, file-to-case functionality

**Changes made:**

SRFax Credentials:
- User added SRFAX_ACCESS_ID and SRFAX_ACCESS_PWD to Cloudflare Pages environment variables
- Redeployed to activate SRFax API

Fax Page Overhaul (src/pages/fax/FaxPage.jsx):
- Received tab (default) with inline PDF preview dialog, file-to-case button, download
- Sent tab with fax status and download
- Search by fax number
- Send Fax dialog with two document source modes: "Upload File" or "From Case"
- "From Case" mode: case type selector (Surrogate/IP/Journey), searchable case dropdown, pick document from case documents list
- Cover page options (Standard, Company, Urgent, Confidential)
- URL params support for prefill from case pages (caseType, caseId)

File to Medical Records Dialog:
- Preview received fax info (from number, pages, date)
- Rename document before filing
- Searchable case selector (Surrogate/IP/Journey)
- Files directly to "medical-records" category in case documents
- Confirmation with case name

Send Fax from Case Pages:
- Added "Send Fax" button to Surrogate Documents tab (next to Send for Signature)
- Added "Send Fax" button to IP Documents tab
- Added "Send Fax" button to Journey Documents tab
- All open /fax in new tab with case pre-selected

New db.js Helper:
- uploadBase64ToCaseDocuments() — converts base64 PDF to blob, uploads to Supabase storage, creates case_documents record

**Next steps:**
- Test with live SRFax data (verify credentials work — may need numeric account ID vs email)
- Test file-to-case flow end-to-end
- Add fax number to clinic/case data for quick-send
- Fax confirmation/delivery status tracking
- Batch fax to multiple numbers

**Open questions:**
- Are the SRFax credentials email-based or does it need a numeric account ID?
- Should there be a default fax number per clinic for quick-send?
- Should sent faxes be logged to the case (like emails)?

---

## 2026-04-02 (Continued — E-Signature Major Overhaul)

**Worked on:** Comprehensive E-Signature system improvements: signed PDF quality, audit trail redesign, form validation, signer role management, "Send for Signature" from case/journey pages, admin dropdown, journey auto-populate

**Changes made:**

Signed PDF Improvements:
- Typed signatures now render in "Dancing Script" handwriting font (dark blue)
- Drawn signatures uploaded to Supabase and inserted as inline images via Google Docs API
- Audit trail completely redesigned: compact 8pt font, fits on one page, page break separator
- Fixed Partner/Parnter typo handling in both signing page and PDF generation

Signing Page Validation:
- All {{Field:Role}} fields are now required before submission (name, initials, text, signature)
- Shows specific missing field names in alert
- Initials field no longer auto-fills — signers must type their own

Send Modal Improvements:
- Modal widened (sm:max-w-3xl), fixed shadcn Dialog sm:max-w-lg override
- Role field changed from text input to dropdown (Surrogate, Partner, IP1, IP2, Admin)
- Admin signer role shows dropdown of Master Admins and Admins (auto-fills name + email)
- Case selector is now searchable input with dropdown (shows name, email, assigned admin)
- Case type must be selected before case search is enabled
- Required signer roles auto-detected from document {{Field:Role}} placeholders
- Green/red badges show which roles are satisfied vs missing
- Send button disabled until all required roles have signers with emails
- Partner auto-populates from intake data (spouseFullName + spouseEmail)
- Added spouseEmail field to GC Application "Confidential Personal Information" section

E-Signature Page Restructured:
- Tabs renamed: "Sent Documents" + "Send for Signature" (was "Documents" + "Templates")
- Removed standalone "Send for Signature" button from Documents tab
- Case name in Documents table is now the clickable link to journey/case (not signer names)
- Signer names in Documents tab link to matched journey if matched, else individual case

Send for Signature from Case/Journey Pages:
- Added "Send for Signature" button to Surrogate, IP, and Journey Documents tabs
- Opens E-Signature page in new tab with case pre-selected
- Templates tab auto-shows with prefill banner
- Journey passes journeyId — auto-populates ALL parties (Surrogate, Partner, IP1, IP2)

Match Sheets:
- Reordered: Clinic → Escrow → Attorney (was Attorney → Clinic → Escrow)

**Next steps:**
- Test drawn signature images appearing in signed PDFs
- Email reminders for unsigned documents
- Build out IP and Journey Documents tabs (currently empty states)
- Copy-on-edit flow for templates
- Surrogate dashboard: view signed documents

**Open questions:**
- Should there be automatic reminders for unsigned documents? If so, how often?
- Should the IP Documents tab mirror the Surrogate Documents tab features?
- How should journey documents merge GC and IP documents with labels?

---

## 2026-04-02 (Continued — Matching, Journey UX, Email Fixes)

**Worked on:** Journey hero redesign (multiple iterations), matching pipeline cleanup, IP intake editing, email button dropdown with compose, log-to-case fix, Emails tab on journey, case_emails table creation

**Changes made:**

Journey Hero (multiple iterations):
- Compact inline layout: Stage/Status as pills with icons (Milestone + Circle)
- Lost Wages/Pumping as click-to-toggle chips
- Pregnancy status with gestational weeks + due date (MM/DD/YYYY)
- Escrow with cents, green/red based on minimum
- OB Clinic + Delivery Hospital (editable inline)
- Case Manager + Journey Manager stacked on right (spelled out)
- GC section: subtle "SURROGATE" label, avatar + name + age(→DOB flip) + relationship + address(click to copy) + flip-card contacts
- IP section: subtle "INTENDED PARENTS" label, same pattern + RE doctor + embryos + egg/sperm donor
- Super light pink/indigo background tints

Matching Pipeline:
- Matched cases hidden from /matching (only on /journeys)
- MATCHED badges removed
- IP color changed to ABC indigo (#283693)

Matched Journeys (/journeys):
- Cards: subtle SURROGATE/INTENDED PARENTS labels, tinted backgrounds, no arrow
- Added pregnancy status, escrow balance (green/red), case manager, journey manager to cards
- Removed gaps (Card gap-0 override)

IP Intake Answers:
- Now fully editable with all fields (name, DOB, email, phone, partner toggle, RE, embryos, donors, etc.)
- Save fetches fresh answers first, syncs to hero

Email Button Dropdown:
- Click Email on surrogate hero shows dropdown: "Email [Name]" (opens compose) or "Copy Email Address"
- Uses DraftContext/ComposeWindows system

Log to Case Fix:
- Fixed case selector: searchable grouped list (Matched Journeys, Surrogates, IPs)
- Was using applicant_name (didn't exist), now uses name/names
- Added matched journeys as a log target

Emails Tab on Journey:
- Added Emails tab to journey detail page
- Merges emails from journey + GC case + IP case (deduplicates)
- Created case_emails table migration (was missing from Supabase)

**Next steps:**
- Add Email dropdown to IP case hero (same as GC)
- Add Email dropdown to journey hero contact buttons
- Embed actual GC/IP profiles in journey Profiles tab (not just links)
- Journey checklist implementation
- Journey documents with GC/IP labels
- System email templates/notifications

**Open questions:**
- Should logged emails show on both the journey AND individual case Emails tabs?
- How should the compose modal pre-fill subject when emailing from a case?

---

## 2026-04-02 (Continued — E-Signature Signing Page)

**Worked on:** Public signing page, email notifications for signers, field placeholder rendering

**Changes made:**

Public Signing Page:
- /e-signature/:id is now a public route (no login required)
- Email verification gate: signer enters email to prove identity
- Shows document title, sent date, signer progress
- PDF preview via iframe if available
- {{Field:Role}} placeholders rendered as form inputs (Name, Email, Date, Initials, Text, Checkbox)
- Name/Email/Date fields auto-fill from signer data
- Signature pad (type or draw)
- Legal agreement checkbox with ESIGN/UETA language
- Standalone branded page (ABC logo, no app chrome)
- HIPAA notice and audit trail messaging

Email Notifications:
- Send for Signature now emails each signer via Gmail API
- Branded HTML email with ABC logo, document title, signer role
- "Review & Sign Document" button links to /e-signature/{docId}
- Legal footer text

Bug Fixes:
- Fixed "insert(...).catch is not a function" — Supabase query builders don't support .catch(), wrapped in try/catch
- Fixed undefined Google Doc ID in iframe (route param name mismatch: `id` vs `templateId`)
- Removed Google Drive draft copies on send
- Fixed audit log insert error

**Next steps:**
- After all signers complete, auto-save final PDF to case documents (create "E-Sign" folder)
- Add document preview from Documents tab (view sent PDF)
- Add email reminders for unsigned documents
- Copy-on-edit: when editing template for sending, copy first so template stays clean
- Handle case where signer has no fields — just show signature pad

**Open questions:**
- Should completed documents auto-file to case documents or require manual action?
- Should there be automatic reminders for unsigned documents? If so, how often?
- How should the copy-on-edit flow work? (Copy on load vs copy on send)

---

## 2026-04-01 / 2026-04-02 (Multi-Day Session — APIs + E-Signature)

**Worked on:** Gmail API, Google Calendar API, SRFax API, E-Signature overhaul with Google Docs integration, floating compose email windows, Gmail signature, unread email badge

**Changes made:**

Google OAuth & APIs:
- Google OAuth2 flow via Cloudflare Pages Functions (auth, callback, refresh, status, disconnect)
- Token storage in Supabase google_tokens table
- Gmail API: inbox, send with attachments, search, log to case, signature auto-insert
- Google Calendar API: multi-calendar, create/edit/delete events, replaced mock calendar
- SRFax API: send/receive/retrieve Cloudflare functions + client helpers + Fax page (awaiting credentials)
- Google Drive API: list docs from ABC Templates folder, export as PDF, share publicly, copy docs
- Connect/disconnect Google in Settings page

Email (/email):
- Gmail-style UI: folder sidebar (Inbox, Starred, Sent, Drafts, Spam, Trash + user labels)
- Sender avatars, unread indicators, checkboxes for bulk actions
- Bulk archive, trash, apply label
- Floating compose windows (Gmail-style, bottom-right anchored)
- Multiple simultaneous drafts with minimize/expand
- Rich text toolbar (bold, italic, underline, strikethrough, colors, highlights, lists, links)
- Gmail signature auto-inserted in compose/reply/forward
- Save as Gmail draft on close
- Case selector in compose to auto-log sent emails
- Unread email count badge on sidebar nav (Primary tab count)
- Emails tab on surrogate and IP detail pages showing logged emails

Calendar (/calendar):
- Rebuilt with Google Calendar API (replaced mock data)
- Multi-calendar support, create/edit/delete events
- Calendar selector sidebar with colored calendars

Fax (/fax):
- SRFax API integration (send with file upload, inbox/outbox, download, cover pages)
- Awaiting SRFax credentials to go live

E-Signature (major overhaul):
- Evolved through multiple approaches: Tiptap editor → Google Docs iframe → final hybrid approach
- Final approach: templates stored as Google Docs in "ABC Templates" Drive folder
- Templates tab syncs from Google Drive, shows all docs with Edit & Send button
- Edit page embeds Google Docs in iframe — full editing with toolbar, pagination, headers/footers
- Send for Signature: exports PDF to Supabase, creates document record, emails signers via Gmail
- Signing field placeholders: {{Signature:GC}}, {{Name:GC}}, {{Date:GC}}, {{Email:GC}}, {{Text:GC}}, {{Initials:GC}}, {{Checkbox:GC}}
- Template delete fix (FK constraint + error surfacing)
- Branded signature request email sent to signers with "Review & Sign Document" button
- Download PDF button exports directly from Google Drive API

**Next steps:**
- Make /e-signature/:id signing page work without login (public route for signers)
- Parse {{Field:Role}} placeholders and render as interactive form inputs on signing page
- After all signers complete, save final PDF to case documents (e-sign folder)
- Add ability to view sent document preview from Documents tab
- Copy-on-edit flow: when editing a template for sending, copy it first so template stays clean
- Clean up [Draft] copies from ABC Templates folder

**Open questions:**
- How should the signing page authenticate signers without an account? (email verification? link token?)
- Should completed documents auto-file to the case documents, or require manual action?
- Should there be email reminders for unsigned documents?

---

## 2026-04-01 (Full Day Session)

**Worked on:** Email bulk actions/counts/categories, Matching pipeline rebuild, Profile sharing, Journey detail page, Match creation, Match notes, Journey hero redesign, Application tab quiz editing

**Changes made:**

Email:
- Bulk actions toolbar (delete, archive, apply labels) when emails selected
- Gmail sidebar categories (Snoozed, Important, Social, Updates, Forums, Promotions, Purchases) under collapsible "More"
- Message counts for all folders/labels using getLabel() API
- Inbox unread count badge on header Email pill
- Pulsing pink dot on header Texts pill for unread SMS

Header:
- Quick-link pills: Home, Email, Texts, Calendar in top bar
- Removed these from sidebar nav

Matching Pipeline (/matching):
- Rebuilt with live Supabase data (replaced all mock data)
- Rich GC cards: profile photo, stage badge, Age/Height/BMI tiles, GTPAL, marital status
- Share Profile button: generates 72hr secure link, sends branded email via Gmail API
- Create Match dialog: select GC + IP → creates matched_journeys record
- Match History: expandable section on each card showing share history (sent to, by, when, viewed)
- Match Notes: clickable on hero cards + matching cards, stored in intake_submissions.answers._matchNotes
- Matched cases hidden from pipeline (only on /journeys)

Shared Profile Page (/share/:token):
- Public page, no login required
- Full surrogate ProfilePreview (or IP info)
- ABC logo at top, confidentiality notice, expiry countdown
- Question form personalized with admin's first name
- Expired/invalid link handling

Matched Journeys (/journeys):
- Rebuilt with live Supabase data
- Tile view: stacked mini-hero cards (pink GC / indigo IP)
- List view: table with all details
- Stage filter pills with counts
- Search by name

Journey Detail Page (/journeys/:id):
- Stacked hero: journey info on top, GC section, IP section
- Click-to-edit journey tiles (Lost Wages, Pumping, Escrow Min, Balance)
- Stage/Status as clickable tiles (last two on right)
- Case Manager + Journey Manager (Julie/Nicole only) dropdowns
- IP color: ABC indigo (#283693) throughout
- Profiles tab: GC/IP toggle
- Notes tab: Shared/GC/IP/All filter with colored labels
- Rich GC section: avatar, name, location, age, phone, email, preferred contact, Text/Email buttons, stat tiles
- Rich IP section: avatar, name, type, RE doctor, embryos, egg/sperm donor, Text/Email buttons

Application Tab:
- Surrogate Quiz section now fully editable with all 16 fields
- Proper form controls (dropdowns, Yes/No toggles, date picker)
- Save fetches fresh answers from Supabase first (prevents data loss)

Bug Fixes:
- Share email: fixed htmlBody→body param for sendEmail
- Match Notes: fetch fresh answers before saving to prevent data overwrite
- ProfilePreview: hideFooter prop for shared profile view

**Next steps:**
- Journey hero redesign: flip-card contact buttons (like GC case), remove height/weight/BMI, add relationship/address flip tiles, pregnancy status/due date/gestational weeks, escrow with cents + color coding, smaller pumping/lost wages tiles
- Embed GC/IP profiles directly in Profiles tab (not just links)
- Journey checklist implementation
- Journey documents with GC/IP labels
- System emails for notifications

**Open questions:**
- How should pregnancy due date / gestational weeks display and update?
- Should the journey auto-advance stage when pregnancy is confirmed?
- Should profile shares show a "Potential Match" on logged-in user's dashboard?
