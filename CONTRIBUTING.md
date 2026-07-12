# Contributing to OneFinance

Thank you for your interest in contributing to OneFinance! This document covers the architecture, conventions, and workflow you'll need.

## Tech Stack

- **Frontend:** Vue 3 (`<script setup>`), TypeScript, PrimeVue, Tailwind CSS
- **State Management:** Pinia
- **Charts:** Chart.js (via PrimeVue Chart)
- **Desktop Runtime:** Electron (Main process in TypeScript)
- **Database:** SQLite encrypted with SQLCipher (`better-sqlite3-multiple-ciphers`)
- **Build Tooling:** Vite, Electron Builder · **Tests:** Vitest

## Architecture

### The one rule that matters most

**The renderer never touches the database, filesystem, or network directly.** All privileged work happens in the Electron main process. The flow is always:

```
Vue component → Pinia store → window.electronAPI (preload.ts) → ipc.ts → db.ts / finance.ts / backup.ts
```

New backend capability = a handler in `electron/ipc.ts` (or `main.ts` for window/OS concerns), exposed in `electron/preload.ts`, wrapped by a Pinia store action.

### Main process (`electron/`)

| File | Responsibility |
|---|---|
| `main.ts` | App entry: window/tray lifecycle, background heartbeat, notifications, auth/lock orchestration |
| `preload.ts` | The only bridge — exposes `window.electronAPI` to the renderer |
| `ipc.ts` | IPC handlers (Renderer ↔ Main) |
| `db.ts` | All SQLite access, schema init, recurring/interest processors |
| `migration.ts` | Sequential DB migration system (see below) |
| `crypto.ts` | AES-256-GCM + scrypt primitives for exports/verifier |
| `security.ts` | `security.json` sidecar (password verifier, remembered key) |
| `rememberPolicy.ts` | Stay-unlocked expiry logic (pure, unit-tested) |
| `secureExport.ts` | Encrypted export/import envelope |
| `backup.ts` | Automated backup scheduling, rotation, settings |
| `finance.ts` | Yahoo Finance quotes, FX rates, dividends (all calls batched/cached — keep API usage frugal) |
| `preferences.ts` | `app-preferences.json` (tray, login, auto-lock, locale) |

### Renderer (`src/`)

| Path | Responsibility |
|---|---|
| `views/` | Page-level components (dashboard, transactions, budgets, goals, investments, insights, calculators, settings, …) |
| `components/` | Reusable UI (`AppChart.vue`, modals, sidebar, command palette) |
| `stores/finance.ts` | Primary store: transactions, accounts, categories, budgets, goals, investments |
| `stores/settings.ts` | Theme, privacy mode, region/locale, backup + app preferences |
| `stores/auth.ts` | Master-password gate state (lock/unlock) |
| `composables/` | Shared logic (`useShortcuts`, `useIdleLock`, `useDashboardLayout`, …) |
| `commands.ts` / `shortcuts.ts` | Single registries for the command palette and keyboard shortcuts |
| `rules.ts` | Pure auto-categorization matcher |
| `types.ts` / `utils.ts` | Shared interfaces and helpers (dates, colors, money math) |

## Prerequisites

- **Node.js** v24+
- **npm** v11+

## Getting Started

```bash
# fork, then:
git clone https://github.com/<your-username>/OneFinance.git
cd OneFinance
npm install
npm run dev   # Vite dev server + Electron with hot-reload
```

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Development mode with hot-reload |
| `npm run typecheck` | `vue-tsc --noEmit` |
| `npm run lint` | ESLint with auto-fix |
| `npm run lint:check` | ESLint check-only (what CI runs) |
| `npm test` | Vitest unit tests (`tests/`) |
| `npm run build` | Type-check + build + package |

## Database Changes

Schema changes must go through the **sequential migration system** in `electron/migration.ts` — never alter a table ad hoc. A schema change means adding a numbered migration step (so existing users' databases upgrade in order) *and* updating `initializeDatabase()` in `electron/db.ts` (so fresh databases are created in the final shape). Any feature that adds persisted data must also round-trip through the encrypted export/import (`src/composables/useDataManagement.ts` + `electron/backup.ts`), tolerating older exports where the data is absent.

## Coding Conventions

- **Components:** Vue 3 `<script setup lang="ts">` only.
- **Imports:** Always the `@` alias (`@/components/...`) — never relative paths.
- **Styling:** Tailwind utility classes first; PrimeVue for complex widgets. Support dark mode (`dark:` variant) in anything you touch.
- **Modals:** Never `window.confirm`/`window.alert` (they block the main process loop) — use `ConfirmationModal.vue` / `ErrorModal.vue`.
- **Dates:** Use `toIsoDateString` / `getDateRange` from `src/utils.ts` for anything sent to the backend (prevents UTC off-by-one-day bugs).
- **Charts:** Always wrap `src/components/AppChart.vue`; chart data transformation lives in chart components, not views.
- **Async:** All DB operations are async; wrap store actions in try/catch.
- **External APIs:** Keep Yahoo Finance usage frugal — batch quotes, cache historical data once per day, no per-row calls.
- **Comments:** Only when the *why* is non-obvious. No docstrings, no "what" comments.
- **DRY:** Derive from existing state; no duplicated logic or data structures.

## Branch & PR Workflow

1. Active development targets the current **release branch** (e.g. `release/2.0.0`), not `main` — `main` tracks the latest published release. Branch off the release branch:
   ```bash
   git checkout release/2.0.0
   git checkout -b 123-short-issue-title
   ```
   Branch names follow `<issue-number>-<kebab-summary>`.
2. Make your changes; keep commits focused.
3. Before pushing, make sure the CI gate passes locally:
   ```bash
   npm run typecheck && npm run lint:check && npm test
   ```
4. Open a PR **into the release branch**, fill in the template, and link the issue. CI (typecheck, lint, tests) must be green.

## Reporting Bugs & Requesting Features

- **Bugs:** open an issue with the **Bug Report** form (steps to reproduce, expected behavior, OS + app version).
- **Feature ideas:** use the **Feature Request** form.
- **Planned development work:** maintainers use the **Development Story** form to spec implementation and acceptance criteria.
- **Security vulnerabilities:** never a public issue — see [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions will be licensed under the MIT License. See [`LICENSE`](LICENSE) for more information.
