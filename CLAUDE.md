# CLAUDE.md

Normative quick reference for this repo. **Precedence:** explicit user instructions →
this file → [`STANDARDS.md`](STANDARDS.md) (long-form) → defaults. The design rationale
lives in [`docs/superpowers/specs/2026-06-10-secret-sharing-design.md`](docs/superpowers/specs/2026-06-10-secret-sharing-design.md).

## What this is

Zero-knowledge, one-time secret sharing. React 19 client + Hono API over SQLite, with a
shared Zod contract. Anonymous (no accounts).

## Invariants — do not break

- **The decryption key never reaches the server.** It is generated in the browser and
  carried only in the URL fragment (`#…`). The server stores ciphertext + a non-secret IV.
- **Lookup ids are stored hashed** (`SHA-256`). The raw id is only ever in the link.
- **`GET /api/secrets/:id` must stay non-consuming** (peek). Only `POST …/reveal` consumes.
- **The burn is atomic** — one conditional `UPDATE … RETURNING` guarded by
  `views < max_views`. Never split it into read-then-write.
- **Never log secret material** (ciphertext, iv, raw ids, request bodies).
- Validate every request body with the Zod schemas in `shared/`. Keep the contract the
  single source of truth for both sides.

## Layout

- `src/` — client. Crypto in `src/lib/crypto.ts`; data hooks in `src/features/secrets/`.
- `server/src/` — API. Business logic in `lib/store.ts`; HTTP wiring in `app.ts`.
- `shared/` — Zod request/response schemas + constants (imported by client and server).
- `tests/` — Playwright E2E.

## Commands

`npm run dev` · `npm run build` · `npm run lint` · `npm test` · `npm run test:coverage` ·
`npm run e2e`. All of lint, build, and tests must be clean before work is "done"
(STANDARDS §7.7). Tests are colocated (`*.test.ts[x]`); coverage thresholds are enforced.
