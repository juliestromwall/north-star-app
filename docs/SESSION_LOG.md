# Session Log

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
