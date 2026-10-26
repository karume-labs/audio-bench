# AGENTS.md

audio-bench is a Tauri v2 + React/Mantine desktop app (Bun monorepo). This
file is the entry point for AI agents working in this repo.

## Guardrails

Mirrored from `/mnt/p5/CODEINE/guardrails` into `.agents/`:

- Rules: `.agents/rules/*.MD` (load order in `.agents/rules/AGENT-USAGE.MD`)
- Examples: `.agents/examples/*.MD`

Always-on set for this repo:

1. `.agents/rules/GENERAL.MD`
2. `.agents/rules/NAMING.MD`
3. `.agents/rules/FEATURE-FOLDER.MD`
4. `.agents/rules/FALLBACKS.MD`
5. `.agents/rules/TOOLING.MD`
6. `.agents/rules/ENV-VARS.MD`

Stack-specific:

- React: `.agents/rules/REACT.MD`
- Mantine UI: `.agents/rules/STYLING.MD` (Mantine section) + `.agents/rules/MANTINE.MD`
- Validation (Zod): `.agents/rules/VALIDATION.MD`
- Loading states: `.agents/rules/LOADING.MD`
- API contract (Tauri IPC): `.agents/rules/API-CONTRACT.MD`

## Project-specific overrides (take precedence over guardrails)

- **Framework:** Tauri v2, not Next.js. No Server Components, no App Router,
  no `page.tsx`/`layout.tsx` route files. Client-only React.
- **State:** Zustand is sanctioned here (desktop app, no URL routing). nuqs and
  TanStack Query are NOT used; do not introduce them.
- **Data fetching:** Tauri IPC via `src/ipc/commands.ts` (`call<T>`). No
  TanStack Query.
- **Styling:** Mantine only. No Tailwind, no shadcn, no `className`/`style`
  overrides where a Mantine prop exists (see MANTINE.MD). Inline `style` is
  permitted only for fixed overlays and geometry that Mantine cannot express
  via props.
- **Validation:** Zod in `packages/domain` (the shared contract). TypeBox is not
  used (no Elysia).
- **Imports:** absolute aliases `@/` (src), `@domain/` (packages/domain/src),
  `@tools/` (tools). Relative imports are being phased out.
- **Default exports:** allowed only where a framework requires them. Prefer
  named exports.

## Hard rules (non-negotiable)

1. No file exceeds ~150 lines. Split on growth.
2. No `any`, `@ts-ignore`, or `as unknown` casts.
3. Arrow functions + named exports.
4. Run `bun format`, `bun lint`, `bun typecheck` (and `cargo check` for Rust)
   before finishing. Lefthook pre-commit is a backstop.

## Commands

- `bun format` / `bun lint` / `bun test` / `bun typecheck` (root fans out)
- `bun run desktop:dev` (vite, port 1420) / `bun run tauri` (full app)
- `cargo check --workspace --all-targets` / `cargo test --workspace`

## Notes

- `rules/STATE-MANAGEMENT.MD`, `rules/DATA-FETCHING.MD`, `rules/DATA-TABLES.MD`,
  `rules/NEXTJS.MD`, `rules/AUTH.MD`, `rules/DRIZZLE.MD`, `rules/SEEDING.MD`,
  `rules/ORPC.MD`, `rules/ELYSIA-EDEN.MD`, `rules/SEO.MD`,
  `rules/REACT-NATIVE*.MD`, `rules/SHADCN.MD`, `rules/SKILL-CREATION.MD`,
  `rules/TESTING.MD` are intentionally NOT mirrored: they target stacks this
  repo does not use (Next.js, Elysia, oRPC, Drizzle, React Native, shadcn,
  TanStack Query, nuqs).