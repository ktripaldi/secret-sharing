# Secret Share

Share a secret (password, token, note) via a one-time, self-destructing link. The
secret is **encrypted in your browser** — the server only ever stores ciphertext and
never sees the decryption key.

> Design spec: [`docs/superpowers/specs/2026-06-10-secret-sharing-design.md`](docs/superpowers/specs/2026-06-10-secret-sharing-design.md) ·
> Engineering standards: [`STANDARDS.md`](STANDARDS.md)

## How it works

1. You type a secret. The browser generates an AES-256-GCM key, encrypts the secret,
   and sends only the **ciphertext** to the API.
2. You get a link: `https://host/s/<id>#<key>`. The key lives in the URL **fragment**
   (`#…`), which browsers never transmit — so the server can't read the secret.
3. The recipient opens the link and clicks **Reveal**. The browser fetches the
   ciphertext, decrypts it with the key from the fragment, and shows it.
4. The secret self-destructs after a chosen number of views or a time limit — whichever
   comes first.

A bare `GET` only **peeks** (non-consuming metadata) so messaging-app link previews
can't burn a secret; a deliberate `POST …/reveal` is what consumes a view.

### Honest limitations

- Like every web-based end-to-end app, you trust the served JavaScript. A strict CSP is
  the mitigation; SRI / signed builds are out of scope.
- The burn is *at-most-once*: if a recipient's decrypt fails (bad link), the view was
  already spent. GCM authentication ensures they *know* it failed.

## Quick start

```bash
npm install
npm run dev          # Vite client (5173) + Hono API (8787), proxied
```

Open http://localhost:5173.

### Production

```bash
npm run build        # typecheck (client + server) + bundle client to dist/
npm run server       # Hono serves the built client + API on :8787
```

Configure via env: `PORT` (default 8787), `SECRETS_DB_PATH` (default `secrets.db`; use
`:memory:` for ephemeral).

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Client + API together (hot reload) |
| `npm run build` | Typecheck both sides, then build the client |
| `npm run typecheck` | Client + server typecheck, no emit |
| `npm run lint` | ESLint, zero warnings allowed |
| `npm test` / `npm run test:coverage` | Unit/integration tests (Vitest) |
| `npm run e2e` | Build, then Playwright E2E (needs browsers — see below) |

## Architecture

```
src/                 React 19 client (zero-knowledge crypto in the browser)
  features/secrets/    create + view screens, TanStack Query hooks
  lib/                 crypto, api-client, secret-link, query-keys, format
server/src/          Hono API over SQLite (better-sqlite3)
  app.ts               routes, validation, rate limiting, security headers, errors
  lib/                 db, store (atomic burn), ids (hashed), rate-limit, errors
shared/              Zod request/response contract + constants (one source, both sides)
tests/               Playwright E2E
```

- **Zero-knowledge:** key in the URL fragment; server stores ciphertext + a non-secret IV.
- **Hashed lookup ids** (`SHA-256`): a DB leak yields no usable keys (STANDARDS §5.4).
- **Atomic burn:** a single conditional `UPDATE … RETURNING` — a race can't over-deliver.
- **Hardening:** strict CSP, `Referrer-Policy: no-referrer`, nosniff, `X-Frame-Options`,
  per-IP rate limiting, no secret material in logs.

## Testing

- **Vitest** — Node project for the API/store (real in-memory SQLite, incl. an atomic
  burn-under-contention test) and a jsdom project for components + an `axe` a11y pass.
  Coverage thresholds are enforced.
- **Playwright** — full browser flow (create → reveal → burned; peek doesn't burn).
  Requires browser system libs: `npx playwright install --with-deps` before `npm run e2e`.
