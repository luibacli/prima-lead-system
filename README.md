# PrimaWell Lead Intelligence System

Internal lead generation and data gathering tool for PrimaWell Medical Clinic.
Identifies companies for YAKAP employee wellness onboarding partnerships.

**INTERNAL USE ONLY — NOT FOR DISTRIBUTION**

---

## Quick Start

### 1. Prerequisites

- Node.js 18+ 
- A [Supabase](https://supabase.com) project (free tier works)
- Chromium (for Playwright scraping)

### 2. Clone and install

```bash
cd prima-lead-system
npm install
npm run playwright:install   # installs Chromium browser for scraping
```

### 3. Set up Supabase

1. Go to [supabase.com](https://supabase.com) → create a new project
2. In your project dashboard → **SQL Editor**
3. Paste and run the contents of `supabase/schema.sql`
4. Go to **Settings → API** and copy:
   - `Project URL`
   - `anon public` key
   - `service_role` key (keep this secret)

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional — for future AI features
OPENAI_API_KEY=sk-...
```

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Features

| Feature | Status |
|---|---|
| Dashboard with stats | ✅ |
| Lead search + scraping | ✅ |
| Lead qualification (HIGH/MEDIUM/LOW) | ✅ |
| Leads table (search, sort, paginate) | ✅ |
| Lead details modal | ✅ |
| Status management | ✅ |
| Internal notes | ✅ |
| Excel export (.xlsx) | ✅ |
| AI enrichment | 🔲 Prepared (stub) |
| Cold email automation | 🔲 Not implemented |

---

## Usage Guide

### Search & Scrape Leads

1. Go to **Search Leads**
2. Enter:
   - **Keyword**: e.g. `BPO`, `Manufacturing`, `Logistics`
   - **Location**: e.g. `Cebu City`, `Mandaue City`
   - **Industry**: select from dropdown
3. Click **Search & Scrape Leads**
4. Results are automatically saved and qualified

The scraper targets `businesslist.ph`. If scraping fails (e.g. site unavailable), it falls back to generated demo data so the system stays usable.

### Manage Leads

1. Go to **All Leads**
2. Use search bar and filters
3. Click **View** on any row to open lead details
4. Update status, add notes, and save

### Export to Excel

- From **All Leads**, click **Export**
- Downloads a formatted `.xlsx` file with all leads

---

## Lead Qualification Rules

| Score | Criteria |
|---|---|
| **HIGH** | Has website + email + phone |
| **MEDIUM** | Missing exactly one field |
| **LOW** | Missing two or more fields |

---

## Project Structure

```
prima-lead-system/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── leads/         # CRUD
│   │   ├── scrape/        # Playwright scraper
│   │   ├── export/        # Excel export
│   │   └── stats/         # Dashboard stats
│   ├── leads/             # Leads management page
│   ├── search/            # Search/scrape page
│   └── page.tsx           # Dashboard
├── components/            # React components
│   ├── layout/            # Sidebar + AppLayout
│   ├── dashboard/         # Stats cards + recent leads
│   ├── leads/             # Table, modal, badges
│   ├── search/            # Search form
│   └── ui/                # Button, Input, Card, Modal, etc.
├── lib/                   # Core services
│   ├── supabase.ts        # Database client + queries
│   ├── scraper.ts         # Playwright scraping engine
│   ├── qualification.ts   # Lead scoring logic
│   ├── excel.ts           # ExcelJS export
│   └── ai.ts              # AI service layer (stub)
├── types/lead.ts          # TypeScript types
└── supabase/schema.sql    # Database setup
```

---

## Deployment on Vercel

> **Important**: The Playwright scraper requires a Chromium binary that exceeds Vercel's function size limit (50MB). Two options:

### Option A — Vercel + separate scrape service (Recommended)

1. Deploy the main app to Vercel normally
2. Deploy a small Express server (just the `/api/scrape` route) to [Railway](https://railway.app) or [Render](https://render.com)
3. Update the scrape endpoint URL in `components/search/SearchForm.tsx`

### Option B — Deploy everything to Railway/Render

1. Push to a GitHub repo
2. Create a new Railway project → Deploy from GitHub
3. Set environment variables
4. Railway/Render supports full Node.js environments with Playwright

### Vercel deployment (UI + API only, no scraping)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard:
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
# SUPABASE_SERVICE_ROLE_KEY
```

---

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, TailwindCSS
- **Database**: Supabase (PostgreSQL)
- **Scraping**: Playwright (Chromium)
- **Export**: ExcelJS
- **AI Ready**: OpenAI SDK (stubbed)

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (server-side only) |
| `OPENAI_API_KEY` | Optional | For future AI features |

---

*PrimaWell Medical Clinic — Internal Tool*
