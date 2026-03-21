# gifted. — GitHub Backup & Portability Guide

This document is for backup and future portability assessment only.
**No production configuration has been changed.**

---

## GitHub Connection Status

The project has a Git repository but **no GitHub remote is connected yet** — only
Replit-internal remotes exist. See "How to connect to GitHub" below.

---

## How to Connect to GitHub

1. In the Replit workspace, click the **Version Control** tab (branch icon in the left sidebar)
2. Click **Connect to GitHub**
3. Authorize Replit to access your GitHub account if prompted
4. Choose **Create a new repository** (recommended) or link an existing one
5. Set visibility to **Private** (recommended — do not push secrets)
6. Replit will add the GitHub remote and push the current branch

After connecting, you can push at any time from the Version Control tab or via:
```bash
git push github main
```

---

## Schema Change History

| Version | Column | Table | Type | Notes |
|---|---|---|---|---|
| Task-28 | `recipient_user_id` | `gifts` | `text` (nullable) | Links received gift to authenticated recipient. Applied via `pnpm --filter db push`. |

---

## Required Environment Variables

These must be set in any environment running this app. **Never commit values.**

### Database
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |

### Authentication
| Variable | Purpose |
|---|---|
| `SESSION_SECRET` | Signs session cookies — must be a long random string in production |
| `GOOGLE_CLIENT_ID` | Google OAuth app client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth app client secret |
| `GOOGLE_CALLBACK_URL` | Full URL for OAuth redirect (e.g. `https://yourdomain.com/api/auth/google/callback`) |

### Payments
| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_live_...` or `sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) |

### SMS / Scheduling
| Variable | Purpose |
|---|---|
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Twilio outbound phone number (e.g. `+17755998628`) |
| `OPERATOR_PHONE` | Phone number that receives operator payment notifications |

### Object Storage
| Variable | Purpose |
|---|---|
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | GCS bucket name for video/photo uploads |
| `PRIVATE_OBJECT_DIR` | GCS path prefix for private objects (videos) |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Comma-separated GCS path prefixes for public objects (photos) |

### App
| Variable | Purpose |
|---|---|
| `APP_ORIGIN` | Base URL used in gift links sent via SMS (e.g. `https://gifted.page`) |
| `PORT` | Server port — set automatically in most hosting environments |

---

## External Services Used

| Service | Purpose | Portal |
|---|---|---|
| **PostgreSQL** | Primary database (users, gifts, sessions) | Any PG provider |
| **Google OAuth** | Social sign-in | [console.cloud.google.com](https://console.cloud.google.com) |
| **Stripe** | Gift checkout + payment processing | [dashboard.stripe.com](https://dashboard.stripe.com) |
| **Twilio** | OTP verification + scheduled gift SMS delivery | [console.twilio.com](https://console.twilio.com) |
| **Google Cloud Storage** | Video and photo file storage | [console.cloud.google.com](https://console.cloud.google.com) |
| **OpenAI** | AI message rewriting (`gpt-4o-mini`) | [platform.openai.com](https://platform.openai.com) |

---

## Local Run Instructions

### Prerequisites
- Node.js 20+
- pnpm (`npm install -g pnpm`)
- PostgreSQL 16 running locally or a remote connection string

### Setup
```bash
# Install dependencies
pnpm install

# Copy and fill in environment variables
cp .env.example .env   # create this file manually — see variables above
# edit .env with your values

# Push database schema
pnpm --filter db push

# Start API server
pnpm --filter @workspace/api-server run dev

# Start frontend (separate terminal)
pnpm --filter @workspace/gifted run dev
```

The API server runs on the port defined by `PORT` (default 8080).
The frontend Vite server proxies `/api` requests to the API server.

---

## Items Requiring Manual Reconfiguration Outside Replit

### 1. Object Storage (highest effort)
Replit manages a Google Cloud Storage bucket automatically. Outside Replit, you must:
- Create a GCS bucket (or swap to S3/Cloudflare R2)
- Create a service account with Storage Object Admin role
- Set `GOOGLE_APPLICATION_CREDENTIALS` or use Workload Identity
- Update `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS`
- Files: `artifacts/api-server/src/lib/objectStorage.ts`, `artifacts/api-server/src/routes/storage.ts`

### 2. PostgreSQL
Replit auto-provisions and sets `DATABASE_URL`. Outside Replit:
- Create a PostgreSQL 16 database
- Set `DATABASE_URL` to the connection string
- Run `pnpm --filter db push` to apply the schema

### 3. Google OAuth Callback URL
The callback URL is environment-specific. Update in two places:
- Your `.env` / hosting platform: set `GOOGLE_CALLBACK_URL=https://yourdomain.com/api/auth/google/callback`
- Google Cloud Console → Credentials → your OAuth app → Authorized redirect URIs

### 4. Stripe Webhook Endpoint
Re-register your webhook endpoint in the Stripe Dashboard:
- Stripe Dashboard → Developers → Webhooks → Add endpoint
- URL: `https://yourdomain.com/api/gifted/stripe/webhook`
- Events to listen for: `checkout.session.completed`
- Copy the new `STRIPE_WEBHOOK_SECRET` to your environment

### 5. Replit Vite Plugins
Two dev-only Replit plugins are in the Vite config:
- `@replit/vite-plugin-runtime-error-modal` — error overlay
- `@replit/vite-plugin-cartographer` — dev tooling

Both are loaded conditionally (`NODE_ENV !== "production"`) and do not affect
production builds. For a non-Replit dev environment, uninstall them and remove
their imports from `vite.config.ts`.

### 6. Session Secret
`app.ts` has a fallback: `process.env.SESSION_SECRET || "gifted-dev-secret-change-in-prod"`.
Always set `SESSION_SECRET` to a strong random value in any non-local environment.

### 7. OTP Gate
`redeem.tsx` currently starts in `"banking"` state (OTP bypassed pending Twilio
toll-free number approval). Restore initial state to `"otp-gate"` once Twilio
approves the number.

---

## Files Safe to Commit

All source code is safe to commit as long as no `.env` file with real values exists.

```
artifacts/          # all app source code
lib/                # shared packages (db, api-spec, etc.)
scripts/            # build and setup scripts
package.json
pnpm-workspace.yaml
pnpm-lock.yaml
tsconfig*.json
.gitignore
MIGRATION.md
replit.md
```

## Files Already Excluded by .gitignore

```
node_modules/
dist/
.cache/
.local/           # agent scratchpad — excluded
*.tsbuildinfo
.DS_Store
```

## Files That Should NOT Be Committed

- Any `.env`, `.env.local`, `.env.production` files with real credentials
- Any service account JSON key files
- `pnpm-lock.yaml` is safe to commit (it's a lockfile, no secrets)

---

## Portability Audit

### Fully Portable (works anywhere, zero changes)
- Express API server architecture
- Drizzle ORM + all database queries
- React + Vite frontend
- Tailwind CSS
- All Stripe payment logic
- All Twilio SMS logic
- Session management (DrizzleSessionStore)
- OpenAI rewrite/generate feature
- Scheduling logic (cron-style `setInterval`)
- Gift creation, preview, reveal, and redeem flows

### Portable with Manual Setup
- PostgreSQL — needs provisioning + `DATABASE_URL`
- Google OAuth — works anywhere, needs callback URL update
- Stripe webhooks — works anywhere, needs re-registration
- Twilio SMS — works anywhere, no changes needed
- Object Storage — works on GCS anywhere; would need code changes to switch providers

### Replit-Specific Components
| Component | Impact if removed | Effort |
|---|---|---|
| Replit-managed PostgreSQL | Must provision own DB | Low |
| Replit Object Storage (GCS) | Must set up own storage | Medium |
| `@replit/vite-plugin-runtime-error-modal` | Dev-only; safe to remove | Trivial |
| `@replit/vite-plugin-cartographer` | Dev-only; safe to remove | Trivial |
| `.replit` config | Platform config; not needed elsewhere | None |
| `replit.nix` channel | Replace with `package.json` engines field | Trivial |
| Replit secret manager | Replace with `.env` or platform secrets | Low |

---

## GitHub Readiness Score: 7 / 10

The core application code is clean and portable. The score is held back by
dependency on two managed Replit services (database and object storage) that
require provider-level setup to replicate. Once those are sorted, this app
would deploy cleanly on Railway, Render, Fly.io, or a VPS.

---

## Top 5 Migration Risks

1. **Object Storage** — The GCS bucket is fully managed by Replit. Video and
   photo uploads will not work outside Replit without provisioning your own
   bucket and service account credentials, and updating the storage module.

2. **PostgreSQL provisioning** — `DATABASE_URL` is auto-injected by Replit.
   Outside Replit you must provision a PostgreSQL 16 instance and run schema
   migrations before the app will start.

3. **Google OAuth callback URL** — The production callback
   (`https://gifted.page/api/auth/google/callback`) is registered in both
   Google Cloud Console and the Replit production env. Moving to a new domain
   requires updating both, or Google login will fail.

4. **Stripe webhook endpoint** — Stripe webhooks are registered against a
   specific URL. Moving domains means re-registering the endpoint and updating
   `STRIPE_WEBHOOK_SECRET`, or payments will appear to succeed but gifts won't
   be marked as paid.

5. **Session secret fallback** — `app.ts` falls back to the string
   `"gifted-dev-secret-change-in-prod"` if `SESSION_SECRET` is not set.
   If this is accidentally deployed without the env var, sessions are
   cryptographically weak. Always verify `SESSION_SECRET` is set in the
   hosting platform before going live.

---

## Safest Next 3 Steps

### Step 1 — Connect to GitHub (5 minutes, zero risk)
Use the Replit Version Control tab to connect and push to a **private** GitHub
repository. This creates an off-platform backup without touching any
configuration.

### Step 2 — Create a `.env.example` file (10 minutes, zero risk)
Add a `.env.example` listing every variable name with placeholder values and a
short description. Commit it to GitHub. This documents what's needed to run
the app anywhere and makes Step 3 much easier.

### Step 3 — Provision a shadow PostgreSQL database (30 minutes, zero risk to production)
Spin up a free PostgreSQL instance on Railway, Neon, or Supabase and run
`pnpm --filter db push` against it with the schema. This validates that the
schema migrates cleanly outside Replit and gives you a warm standby if ever
needed. Do not point any production traffic at it.
