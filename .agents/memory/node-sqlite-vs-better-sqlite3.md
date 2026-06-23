---
name: node:sqlite vs better-sqlite3
description: Prefer node:sqlite (Node 24 built-in) over better-sqlite3 in this monorepo — avoids native binding compilation and pnpm approve-builds friction.
---

## Rule
Use `node:sqlite` (`DatabaseSync` from `'node:sqlite'`) for SQLite access. Do NOT add `better-sqlite3` as a dependency.

**Why:** `better-sqlite3` requires native .node bindings compiled for the current Node ABI. In Replit's Node 24 environment, `pnpm rebuild better-sqlite3` produces no output and the bindings are never built — the server crashes at startup with "Could not locate the bindings file". `node:sqlite` is built-in and requires zero compilation.

**How to apply:** Replace any `import Database from "better-sqlite3"` with `import { DatabaseSync } from "node:sqlite"`. The API is nearly identical (`new DatabaseSync(path)`, `.prepare()`, `.run()`, `.get()`, `.all()`, `.exec()`). It emits an ExperimentalWarning in logs — safe to ignore.
