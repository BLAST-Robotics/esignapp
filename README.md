# KeySign

A drag-and-drop e-signature platform. Upload PDFs, place signature/name/date/email/phone fields on any page, and collect legally binding signatures with shareable links. Built with Next.js 16, Tailwind CSS v4, react-pdf, pdf-lib, and recharts.

## Project Structure

```
src/
├── app/
│   ├── admin/                          # Admin dashboard & editor
│   │   ├── AdminClient.js              # Login, document list, stats, user mgmt
│   │   └── documents/[id]/EditorClient.js  # Per-document field editor
│   ├── sign/[id]/page.js               # Public signing page wrapper
│   ├── s/[slug]/page.js                # Friendly slug redirect
│   ├── thank-you/page.js               # Post-signing confirmation
│   ├── page.js                         # Landing page
│   ├── layout.js                       # Root layout (app name, favicon)
│   ├── globals.css                     # Tailwind v4 + custom styles
│   └── api/
│       ├── auth/                       # Authentication endpoints
│       │   ├── register/route.js       #   POST - create account
│       │   ├── login/route.js          #   POST - sign in (email+password)
│       │   ├── me/route.js             #   GET  - current session user
│       │   └── logout/route.js         #   POST - destroy session
│       ├── documents/                  # Document CRUD
│       │   ├── route.js                #   GET (list), POST (upload)
│       │   ├── [id]/route.js           #   GET, PUT, DELETE (permission-aware)
│       │   ├── [id]/fields/route.js    #   PUT - save field positions
│       │   ├── [id]/signatures/route.js#   GET - per-document signatures
│       │   ├── [id]/permissions/route.js#  GET/POST/DELETE - sharing
│       │   ├── [id]/settings/route.js  #   GET/PUT - per-document settings
│       │   └── [id]/download-all/route.js # GET - ZIP of all signed PDFs
│       ├── admin/                      # Admin-only endpoints
│       │   ├── signatures/             #   GET (all), POST (manual)
│       │   ├── signatures/[id]/        #   GET, PUT, DELETE
│       │   ├── download/route.js       #   GET - single signed PDF
│       │   ├── download-all/route.js   #   GET - ZIP download
│       │   ├── migrate/route.js        #   POST - legacy migration
│       │   ├── settings/route.js       #   GET/POST - global settings
│       │   └── users/                  #   GET (list), POST (create)
│       │       └── [id]/route.js       #   PUT, DELETE
│       ├── public/
│       │   └── document/[id]/          # Unauthenticated doc access
│       │       ├── route.js            #   GET - doc info + fields
│       │       └── pdf/route.js        #   GET - raw PDF file
│       ├── sign/route.js               # POST - submit signature + validation
│       ├── send-email/route.js         # POST - email signed document
│       └── settings/route.js           # GET - public settings
├── components/
│   ├── DocumentSigner.js               # Full signing page (fields, preview, confetti)
│   ├── SignaturePicker.js              # Draw / type / auto-signature canvas
│   ├── SignatureChart.js               # Recharts area chart over time
│   ├── SignForm.js                     # Legacy handbook form (unused)
│   ├── SignFormWrapper.js              # Dynamic import wrapper
│   ├── ThemeProvider.js                # next-themes provider
│   ├── ThemeToggle.js                  # Dark/light toggle
│   └── ErrorBoundary.js                # React error boundary
├── lib/
│   ├── auth.js                         # Hashing, sessions, permissions, user CRUD
│   ├── storage.js                      # JSON/Postgres dual storage layer
│   ├── settings.js                     # Global settings (legacy)
│   ├── stampPdf.js                     # PDF-lib stamping engine
│   └── db.js                           # Postgres schema (legacy)
└── app/
    └── icon.png                        # Favicon (white quill on transparent)
```

## Install

```bash
npm install
```

## Setup

Copy `.env.example` to `.env.local`:

```env
ADMIN_PASSWORD=admin
POSTGRES_URL=postgres://user:password@host:5432/database
```

The app auto-detects Postgres from any of these env vars (first found wins): `POSTGRES_URL`, `STORAGE_URL`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_DATABASE_URL`, `NEON_DATABASE_URL_UNPOOLED`, `PRISMA_POSTGRES_URL`.

- **Postgres** is optional — local development uses JSON files in `.data/`
- **ADMIN_PASSWORD** enables a dev-mode login override (any email + this password)

A seeded admin user is created on first run:
- Email: `hello@keystonestemai.org`
- Password: `Keystone#2026$`

## Run

```bash
npm run dev
```

Open `http://localhost:80/admin`

## Build

```bash
npm run build
npm start
```

## Deploy to Vercel

[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Push this repo to GitHub/GitLab/Bitbucket
2. Import the project in Vercel
3. **Set up a Postgres database** via **Storage → Marketplace** — any of these auto-inject `POSTGRES_URL` after linking:
   - [Neon](https://vercel.com/integrations/neon) — serverless Postgres, free tier
   - [Supabase](https://vercel.com/integrations/supabase) — Postgres + real-time, free 500 MB
   - [Nile](https://vercel.com/integrations/nile) — multi-tenant Postgres, free tier
   - [Prisma Postgres](https://vercel.com/integrations/prisma-postgres) — managed Postgres, free tier
4. **Optional**: set `ADMIN_PASSWORD` as a dev-mode override for local testing
5. Deploy — the postinstall script copies the PDF.js worker to `public/` automatically

The Postgres schema auto-creates on first request. No migrations to run.

### Storage options

| Service | Type | Free tier |
|---------|------|-----------|
| **Neon** (Marketplace) | Serverless Postgres | 500 MB, compute credits |
| **Supabase** (Marketplace) | Postgres + real-time | 500 MB |
| **Nile** (Marketplace) | Multi-tenant Postgres | Usage-limited |
| **Prisma Postgres** (Marketplace) | Managed Postgres | Usage-limited |
| **Local JSON** (dev default) | File-based | Unlimited |

All Postgres options work identically — the app uses `@vercel/postgres` and auto-detects `POSTGRES_URL`.

### Edge Config & Blob

**Vercel Edge Config** (fast KV for feature flags) and **Vercel Blob** (file storage for uploads) are available under **Storage** but this app does not use them currently. Uploaded PDFs are stored in `.data/uploads/` (JSON mode) or on the filesystem directly.

### Local Postgres (optional)

If you want to use Postgres locally instead of JSON files, create a free Postgres instance on [Neon](https://neon.tech), [Railway](https://railway.app), or run it with Docker:

```bash
docker run -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:17
```

Then set `POSTGRES_URL=postgres://postgres:postgres@localhost:5432/postgres` in `.env.local`.

The app auto-detects a real Postgres URL — if it's set, JSON files are ignored.

## Usage

1. **Create an account** at `/admin` (or use the seeded admin)
2. **Upload a PDF** — the editor opens with a full-page PDF view
3. **Add fields** — right-click the PDF or use the Add Field button. Drag to reposition, resize with corner handles
4. **Configure fields** — set label, type (name/signature/date/email/phone/other), font size, page, date format, default signature method, and validation rule
5. **Share** — copy the sign link or friendly slug URL. Optionally collect email before signing
6. **Share with other users** — use the Share button to grant view/edit/manage access by email
7. **Signatures appear in real-time** on the Signatures tab — view field values, download individual PDFs, or download all as ZIP

## Features

- **Multi-user auth** — email/password registration, session-based login, admin role
- **Document sharing** — per-document permissions (view / edit / manage)
- **Drag-and-drop editor** — place fields on any PDF page, resize, right-click context menu
- **Field types** — name, signature (draw/auto/type), date (auto-signing or custom format), email, phone, other
- **Field validation** — required, email format, phone format, minimum length
- **Email collection** — optional email input step before signing
- **Same-label sync** — fields with identical labels share values on the sign page
- **Signed PDF download** — individual or batch ZIP download
- **Signature viewer** — per-document table with field values, IP, location, timestamp
- **Admin dashboard** — stats, signature chart, document list with inline rename
- **Admin user management** — list, edit, delete all users
- **Dark mode** — neutral-900 palette, toggle in header
- **Mobile responsive** — works on all screen sizes

## Storage

Two modes, auto-detected by the `POSTGRES_URL` environment variable:

| Mode | Trigger | Storage |
|------|---------|---------|
| **JSON** (dev) | `POSTGRES_URL` is placeholder or unset | Files in `.data/` (documents.json, signatures.json, users.json, sessions.json, permissions.json, uploads/) |
| **Postgres** (prod) | Real `POSTGRES_URL` on Vercel or elsewhere | `@vercel/postgres` with auto-created schema |

## Stack

Next.js 16 (App Router, Turbopack), Tailwind CSS v4, react-pdf 10.4.1, pdf-lib 1.17.1, recharts 3.8.1, react-signature-canvas 1.1.0, @vercel/postgres 0.10.0, archiver 8.0.0, nodemailer 6.10.0

---

By: Virat R. Ponugoti
