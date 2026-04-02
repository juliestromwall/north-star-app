# Session Log

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
