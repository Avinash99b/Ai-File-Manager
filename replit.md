# AI File Manager

A React Native (Expo) mobile app with an Express backend that lets users manage files using natural language commands, semantic search, and ACID-safe transactions with automatic snapshots.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxy at /api)
- `pnpm --filter @workspace/mobile run dev` — run the Expo app (port 18115)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- After codegen, always overwrite `lib/api-zod/src/index.ts` with `export * from "./generated/api";` (one line)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: `node:sqlite` built-in (Node 24, no native deps) — replaces better-sqlite3
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Mobile: Expo (React Native), Expo Router, TanStack Query
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/api-spec/orval.config.ts` — codegen config (no `schemas` key in zod output)
- `lib/api-zod/src/index.ts` — manually kept as one-liner after codegen
- `lib/api-client-react/src/` — generated React Query hooks
- `artifacts/api-server/src/lib/` — core backend logic (database, embeddings, transactions, aiparser, aiignore)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/data/files/` — managed files directory (seeded with sample files)
- `artifacts/api-server/data/db/` — SQLite database
- `artifacts/api-server/data/snapshots/` — snapshot storage (one folder per snapshot)
- `artifacts/api-server/data/tmp/` — transaction working directories
- `artifacts/mobile/app/` — Expo Router screens
- `artifacts/mobile/context/` — FileManagerContext, TransactionContext
- `artifacts/mobile/components/` — FileItem, ActionCard, TransactionCard, SnapshotCard

## Architecture decisions

- **`node:sqlite` over `better-sqlite3`**: Node 24 has a built-in SQLite module (`node:sqlite`) that requires no native compilation. Avoids pnpm approve-builds friction.
- **Transaction-based file ops (ACID)**: Every AI command creates a transaction. Files are copied to a tmp directory, changes are previewed there, then committed atomically to the real files directory. A snapshot of affected files is saved before each commit.
- **TF-IDF semantic search**: No external API needed. Files are tokenized and indexed in SQLite. Search uses cosine similarity between query and document TF vectors.
- **Rule-based NLP parser**: Regex patterns handle rename/delete/move/copy/create. Falls back to code generation for complex requests. Supports glob patterns (`vol-*.log`) and filename matching.
- **`.aiignore` support**: Follows `.gitignore` syntax. Ignored files are excluded from listing, indexing, and all operations.
- **Orval zod output**: `schemas` key removed from orval zod config to avoid duplicate export errors (both api.ts and types/ export same names). Only Zod schemas generated; TypeScript types come from api-client-react.

## Product

- **Files tab**: Browse the managed file space, navigate directories, see file metadata and index status. Tap the database icon to index files for semantic search.
- **Search tab**: Find files by semantic meaning (TF-IDF cosine similarity), filename, or both. Results show match type and confidence score.
- **Actions tab (Transactions)**: History of all AI-driven file operations. Shows status (pending/previewed/approved/completed/rejected).
- **Snapshots tab**: Automatic point-in-time backups created before each committed transaction. One-tap restore.
- **AI command bar**: Type natural language commands on the Files tab. Opens the action modal to parse, preview, and approve changes.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After running `pnpm --filter @workspace/api-spec run codegen`, always overwrite `lib/api-zod/src/index.ts` to single line: `export * from "./generated/api";` — codegen regenerates it with two lines (types + api) causing TS2308 duplicate export errors.
- `node:sqlite` is experimental in Node 24 — produces ExperimentalWarning in logs, safe to ignore.
- The api-server reads/writes files relative to `artifacts/api-server/data/` regardless of working directory.
- `vm2` is installed but unused; code execution uses Node's built-in `vm` module for sandboxing.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
