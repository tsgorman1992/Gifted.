# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Features

### gifted. (artifacts/gifted)
- Landing page, Create gift flow, Preview, Reveal, and Redemption pages
- AI-powered personal note rewriting and regeneration on the Create page
  - "Rewrite with AI" — improves the existing note while keeping the sentiment
  - "Regenerate" — writes a fresh note from scratch based on occasion, recipient, intent
  - Streams responses token-by-token with a live typing effect and subtle glow animation
  - Backend route: `POST /api/gifted/rewrite-note` (SSE streaming)
  - Uses `gpt-4o-mini` via Replit AI Integrations (no user API key required)
- Photo upload on Create page
  - Tapping "Add Photos" opens native file picker with multi-select (image/* MIME filter)
  - Up to 6 photos, 20 MB each, with validation
  - Each photo uploads to GCS via presigned URL with individual progress tracking (XHR)
  - Shows 3-column thumbnail grid with per-photo upload spinner and progress %
  - Completed photos show hover-to-reveal X button for removal
  - "Add more" pill button appears when < 6 photos uploaded
  - Photos persist to Reveal page via localStorage key `gifted_photo_paths` (JSON array of objectPaths)
  - Reveal page shows uploaded photos in a responsive grid, falls back to Unsplash mocks when none uploaded
- Video upload on Create page
  - Tapping "Add a Video" opens native file picker (camera + gallery on mobile, file browser on desktop)
  - Videos upload to GCS via presigned URLs with progress indicator (XHR for real progress tracking)
  - After upload, shows inline video preview with Remove option
  - 100 MB file size limit, video/* MIME type validation
  - Video persists to Reveal page via localStorage (stores objectPath)
  - Backend: `POST /api/storage/uploads/request-url` for presigned URLs, `GET /api/storage/objects/*` for serving
  - Storage proxy supports HTTP Range requests for mobile video streaming (206 Partial Content)
  - Uses Replit Object Storage (GCS-backed, no user API key required)
- Video playback on Reveal page
  - Single `<video>` element with ref-based `.play()` on tap (no DOM swap — critical for mobile autoplay)
  - `videoError` fallback state when video fails to load
  - Play overlay with sender name attribution
  - Preview page shows video preview card with controls when video is uploaded
- Personal Note (optional)
  - Create page: note field has "(optional)" label, AI Rewrite button disabled when note is empty
  - Persists via localStorage key `gifted_personal_note`
  - Reveal page: note card hidden entirely when no note provided; uses dynamic text from localStorage
- Playlist
  - Create page: playlist URL input wired to state, persists via localStorage key `gifted_playlist_url`
  - Reveal page: renders as tappable deeplink card with Music icon, auto-detects Spotify/Apple Music
  - Preview page: shows Playlist badge conditionally
- Gift Persistence & Shareable Links
  - Database: `gifts` table in PostgreSQL via Drizzle ORM (`lib/db/src/schema/gifts.ts`)
    - Columns: id (nanoid 12-char), recipientName, senderName, experience, occasion, giftTitle, personalNote, videoPath, photoPaths (JSONB array), playlistUrl, createdAt
  - API: `POST /api/gifted/gifts` — saves gift to DB, returns `{ id }`
  - API: `GET /api/gifted/gifts/:id` — fetches gift by ID, returns full payload or 404
  - Share: `GET /api/share/:id` — renders OG meta tags from DB data, redirects to `/open/:id`
  - Frontend: `/open/:id` route fetches gift from API, hydrates localStorage, then renders RevealPage
  - Frontend: `/preview` page saves gift to DB on first share/copy/SMS action, caches giftId to avoid duplicates
  - The `/reveal` route still works as a local preview (reads from localStorage only)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── object-storage-web/  # Client upload hook for object storage
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/gifts.ts` — `gifts` table (gift persistence for shareable links)
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
