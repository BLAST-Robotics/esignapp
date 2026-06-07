# Changelog

### v1.2.0 (2026-06-07)
- **Feature**: Google OAuth sign-in — "Sign in with Google" button on admin login page
- **Feature**: Custom domain restriction via `GOOGLE_ALLOWED_DOMAINS` env var
- **Feature**: Account merging — Google OAuth links to existing email/password accounts
- **Feature**: OAuth users created with `password: 'oauth:google'` (cannot sign in via password, only Google)
- **Auth**: `next-auth@5.0.0-beta.31` integrated with JWT session strategy
- **Auth**: `src/lib/auth.config.js` — shared NextAuth config with Google provider
- **Auth**: `src/app/api/auth/[...nextauth]/route.js` — NextAuth route handler
- **Auth**: `src/app/api/auth/oauth-exchange/route.js` — exchanges NextAuth session for app Bearer token
- **Env**: Added `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`, `GOOGLE_ALLOWED_DOMAINS` to `.env.example`

### v1.1.0 (2026-06-07)
- **Fix**: 50 req/sec cascade on fields editor — memoized `authHeaders` in EditorClient
- **Fix**: Context menu "Create Field" now opens editor instead of closing
- **Fix**: Bottom bar changed from `sticky` to `fixed` — always visible at viewport bottom
- **Fix**: New fields detect currently visible PDF page (viewport-based)
- **Fix**: Remove signature button — increased to `w-7 h-7`, fixed `overflow-hidden` clipping
- **Fix**: Signature field width — added `w-full` to "Tap to sign" button (was rendering at content-width instead of edited field width)
- **Fix**: Field text colors always use light palette (PDF background is always `#404040`)
- **Fix**: Date field color changed from `#000` (invisible on dark bg) to `#d4d4d4`
- **Security**: Moved seed admin password to `SEED_ADMIN_PASSWORD` env var (no hardcoded default)
- **Security**: Rate limiting on login (10/min) and sign (30/min) endpoints
- **Security**: `HttpOnly; Secure; SameSite=Strict` cookies on login/register
- **Security**: `requireAuth` dev override (`x-admin-password`) gated on `NODE_ENV !== 'production'`
- **Security**: Email normalization (`trim().toLowerCase()`) applied everywhere
- **Security**: Field whitelist on admin user updates (prevents SQL injection)
- **Security**: Scrypt with explicit params (`N: 16384, r: 8, p: 1`)
- **Fix**: `isPostgres is not defined` — added missing driver import
- **Fix**: `ensureJSON is not defined` — added helper to auth driver
- **Fix**: Login crash on null password — added guard in `verifyPassword`
- **Fix**: Admin route creates hashed passwords (plain-text users could never log in)
- **Fix**: `createUser` checks existing email before insert (consistent 409)
- **Fix**: `readJSON` handles empty/corrupt files (500 instead of crash)
- **Fix**: Removed `DEFAULT gen_random_uuid()` from Postgres schema (PG 12+ compat)
- **Fix**: `client.sql.query is not a function` — switched to `client.query()`
- **Fix**: `/api/auth/me` calls `initAuthTable()` and checks session expiry
- **Fix**: Admin user list strips password hash from response
- **Fix**: Documents list strips `file_data` from list responses (no Buffer serialization)
- **Fix**: Admin settings route uses `requireAdmin` instead of `requireAuth`
- **Fix**: Sign endpoint validates doc status and prevents duplicate email signatures
- **Fix**: Admin user update has field whitelist (`name`, `email`, `role`, `password`)
- **Build**: Switched to Bun for local dev, Node.js for production scripts
- **Build**: Added `"type": "module"` to package.json
- **Migration**: JSON → Postgres migration handles missing file_data, orphaned signatures, UUID remapping
- **DB**: Production schema aligned — `password_hash` → `password`, `expires` → `expires_at`, added `created_at` in sessions, added `file_data BYTEA` in documents

### v1.0.0 (2026-06-06)
- **Multi-document**: Refactored storage from single `documents.json` to per-doc files. Added document list view with inline rename, delete, and slug-based routing
- **Multi-user auth**: Split `auth.js` — `requireAuth` reads session cookie, `requireAdmin` gates admin-only routes. Roles enum: `admin`, `viewer`
- **User management**: Admin users page with list/edit/delete. `admin/users/route.js` — field-whitelisted update, password hash stripped from responses
- **Email collection**: Optional `requireEmail` flag per document. Pre-sign step renders email input in `DocumentSigner`, stored in `signer_email` column
- **Document sharing**: Per-doc permissions table (`user_id`, `doc_id`, `level`). Editor checks permission before allowing edits. Share dialog in `EditorClient`
- **Autosave**: `useEffect` in `EditorClient` debounces field position saves to `/api/documents/[id]/fields`
- **Thank-you screen**: `/thank-you` page with confetti animation, download link, and "back to home" button
- **Slug URLs**: `slug` field auto-generated from doc title in `/api/documents/[id]`. `app/s/[slug]/page.js` redirects to `/sign/[id]`
- **Admin dashboard**: `/admin/page.js` — `SignatureChart` (recharts area chart by date), document stats (total, signed, pending), recent activity list
- **Dark mode**: `ThemeProvider` + `ThemeToggle` using next-themes. CSS variables in `globals.css`. Persisted in localStorage
- **Signature viewer**: Per-document `/api/documents/[id]/signatures` returns field values, IP, location, timestamp. Rendered in admin tab

### v0.5.0 (2026-06-02)
- **Auth overhaul**: Replaced bcrypt with scrypt (`crypto.scryptSync`, N:16384, r:8, p:1). Session tokens stored in `sessions.json` with SHA-256 hashing. `login/route.js` returns `Set-Cookie` with `HttpOnly; Secure; SameSite=Strict`
- **Storage refactor**: Created `api/documents/[id]/route.js` with GET/PUT/DELETE — permission-aware, returns 403 for non-owners. File uploads stored in `.data/uploads/` with UUID filenames
- **Admin settings**: `/api/admin/settings` — GET/POST for global config (default signature method, email requirements). Settings stored in `settings.json`
- **ZIP download**: `/api/admin/download-all` — streams ZIP using archiver. Sig DB mapped to per-doc folders with `{label}.png` naming
- **Branding**: Custom favicon (`icon.png` — white quill on transparent). App name in root layout from `layout.js`

### v0.4.0 (2026-05-28)
- **Drag & drop**: `onPointerDown` / `onPointerMove` on field overlay divs in `EditorClient`. Fields repositioned by updating `x`, `y` in field state. Constrained to PDF page bounds
- **Resize handles**: Corner handles (`nw`, `ne`, `sw`, `se`) rendered as 12px squares. `onPointerDown` captures the handle type, delta applied to `x`/`y`/`w`/`h`. Minimum size 40×20px. Handles hidden while dragging
- **Context menu**: Right-click handler on PDF container. Menu renders at cursor position with "Edit Field", "Delete Field", "Create Field" options. "Create Field" inserts a new field at click coordinates
- **Field config modal**: Modal on double-click with dropdowns for field type, date format, default signature method, font size slider, label text input. Config saved to field object in state
- **Same-label sync**: `useMemo` groups fields by label. On sign page, updating one field updates all fields with the same label. Label groups rendered with `React.memo`
- **PDF page detection**: Fields render only on their assigned `page` index. Editor highlights current page in thumbnail strip

### v0.3.0 (2026-05-22)
- **Multi-page PDF**: `react-pdf` `Document`/`Page` component with page navigation (prev/next buttons, page number input). PDF loaded from `file_data` or filesystem path. Page count read from `numPages`
- **Single-document editor**: `EditorClient.js` — loads PDF via `/api/documents/[id]`, renders fields as absolute-positioned overlays. Field state managed with `useReducer`. Save button POSTs to `/api/documents/[id]/fields`
- **Signature canvas**: `SignaturePicker.js` — draw mode using `react-signature-canvas`, type mode renders text input with handwriting font, auto-generate creates a cursive-style text path on canvas. Output as data URI (PNG). Signature pad resets to empty canvas after acceptance
- **Field types**: `name`, `signature`, `date`, `email`, `phone`, `other` — stored as `field_type` enum. Signature fields show "Tap to sign" placeholder, others use `div` overlays with `contenteditable` or `input`
- **Field validation**: `required` flag prevents submission if empty. `email` regex validation on blur. `phone` regex (`/^\+?[\d\s\-()]{7,}$/`). `minLength` check on sign submit. Validation errors shown as red text below field
- **Overlay rendering**: Fields rendered in `DocumentSigner` with absolute positioning scaled by PDF-to-container ratio. Z-index managed by field order in array. Non-signature fields use transparent input overlays

### v0.2.0 (2026-05-16)
- **UI overhaul**: Migrated from plain CSS to Tailwind CSS v4. Color palette switched to `neutral-900` background, `neutral-100` text, blue accent. All components updated to use Tailwind utility classes
- **Mobile responsive**: `SignFormWrapper.js` — media query breakpoints at 640px, 768px. Field overlays scale with viewport. Sidebar collapses to bottom drawer on mobile
- **Font size control**: Per-field `fontSize` setting (12–48px range). Applied via inline `style={{ fontSize }}` on field text elements. Non-signature fields also read font size
- **Date formats**: `date_format` field — `signing-full`, `signing-short`, `MM/DD/YYYY`, `YYYY-MM-DD`, `DD/MM/YYYY`. Auto-signing dates (`signing-*`) calculate on render. Manual dates show `<input type="date">` on sign page
- **Default signature method**: `default_method` field — `draw`, `type`, `auto`. Preselected in SignaturePicker. Falls back to method picker if not set

### v0.1.0 (2026-05-10)
- **Initial prototype**: Single hardcoded PDF (`sample.pdf` in `public/`). Fields stored as JSON array in `fields.json`. No multi-page support. Fields placed at hardcoded coordinates
- **Basic auth**: `login/route.js` — email + password form. Passwords stored as base64 SHA-256 (upgraded later). Session stored in cookie with simple UUID token. No expiry
- **Session management**: `sessions.json` — `{ token, email, createdAt }`. Checked in `requireAuth` middleware. No logout endpoint initially
- **JSON file storage**: `storage.js` — `readJSON`/`writeJSON` helpers. `documents.json` stores whole doc objects. `signatures.json` stores field values per signer. No Postgres support
- **PDF-lib stamping engine**: `stampPdf.js` — loads PDF with `pdf-lib`, embeds signature PNG on page at field coordinates, flattens form. Supports multiple signatures per page. Outputs signed PDF as Buffer
- **Admin login page**: Minimal `/admin` — password field only (no email), redirects to `/admin/dashboard` on success. One hardcoded admin user. No registration
