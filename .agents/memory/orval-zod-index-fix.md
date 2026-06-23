---
name: Orval zod index.ts duplicate export fix
description: After every codegen run, lib/api-zod/src/index.ts must be overwritten to a single-line export to avoid TS2308 duplicate export errors.
---

## Rule
After running `pnpm --filter @workspace/api-spec run codegen`, immediately overwrite `lib/api-zod/src/index.ts` with exactly:
```ts
export * from "./generated/api";
```

**Why:** Orval regenerates `index.ts` with two exports:
1. `export * from "./generated/api"` (Zod schemas — ExecuteCodeBody, etc.)
2. `export * from './generated/types'` (TypeScript types with same names)

Both export identical names, causing TS2308 duplicate export errors. Removing the `schemas` key from orval config stops generating the types directory, but orval still writes the two-line index.ts referencing the now-absent types directory.

**How to apply:** Add a post-codegen step that writes the single-line file, OR manually run the write immediately after codegen. The codegen script in api-spec runs `typecheck:libs` at the end — it will fail if this fix isn't applied first.
