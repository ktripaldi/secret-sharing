# Secret Sharing — Design Spec

- **Date:** 2026-06-10
- **Status:** Approved (ready for implementation planning)
- **Author:** Kenderson Tripaldi
- **Precedence:** This spec is normative for the secret-sharing feature. Where it is silent, `STANDARDS.md` governs.

---

## 1. Summary

A zero-knowledge secret-sharing app. A creator types a secret (password, token, note), the browser encrypts it, and the app returns a one-time share link. A recipient opens the link, clicks **Reveal**, and the browser decrypts and displays the secret. The secret self-destructs after a configurable number of views or a time-to-live — whichever comes first. The server stores **only ciphertext** and never sees the decryption key.

Comparable products: OneTimeSecret, PrivateBin, password.link, 1Password Psst!.

## 2. Goals / Non-goals

**Goals**
- End-to-end (zero-knowledge) encryption: the server cannot read secrets.
- Anonymous: no accounts, minimal PII.
- One-time / N-time view with burn-after-read.
- Time-to-live expiry independent of views.
- Strong defaults and security posture aligned with `STANDARDS.md` §5.

**Non-goals (v1)**
- User accounts, dashboards, sent-history.
- Recipient identity / per-recipient access logs.
- Creator passphrase layered on top of the link (explicitly dropped during brainstorming).
- Multi-node horizontal scaling (single-node SQLite + in-memory rate limiter for v1).

## 3. Resolved decisions

| Fork | Decision |
|---|---|
| Architecture | Backend + **zero-knowledge** client-side encryption |
| Lifecycle | Configurable **max-view count** (default 1 = one-time) **+ TTL**; burn on whichever trips first |
| Auth | **Anonymous** — no accounts |
| Stack | **Hono** (TypeScript API) + **SQLite** (`better-sqlite3`), **Zod** validation, **Vitest** + **Playwright** |
| Frontend | React 19 + TypeScript (existing Vite app) + TanStack Query |
| Passphrase | Out of scope |
| Creator revoke link | Out of scope for v1 (documented extension — §13) |

## 4. Security model

### 4.1 Cryptography
- **AES-256-GCM** via the Web Crypto API (`crypto.subtle`), entirely in-browser.
- Per secret: a random **256-bit key** and random **96-bit IV**. GCM provides authenticated encryption — wrong key or tampered ciphertext fails loudly instead of returning corrupted plaintext.
- The **key is placed in the URL fragment**: `https://host/s/<id>#<key>`. Browsers never transmit the fragment in HTTP requests, so the server is structurally unable to receive the key.
- The **IV is not secret** (GCM requires only uniqueness), so it is stored server-side next to the ciphertext to keep links short.

### 4.2 Hashed lookup id (STANDARDS §5.4)
- `<id>` is a 256-bit random token, returned by the server at creation and placed in the link by the client.
- The server persists the row under **`SHA-256(<id>)`**, never the raw id. A database leak exposes only hashes and undecryptable ciphertext.

### 4.3 Threat model & honest limitations
- **Trust in served JavaScript.** As with every web-based E2E app, a malicious or compromised server could serve JS that exfiltrates the key. Mitigated by a strict CSP (§9); stronger defenses (SRI, signed/reproducible builds) are out of scope.
- **At-most-once burn.** If the recipient's decryption fails (mangled link, wrong key), the view was already consumed server-side. GCM authentication ensures the recipient *knows* it failed rather than seeing corruption.
- **Existence disclosure.** A short-lived tombstone lets a returning recipient see "already viewed" rather than "never existed." Because ids are 256-bit random, enumeration is infeasible; this is an accepted, documented trade-off favoring UX.

## 5. End-to-end data flow

```
CREATE
  Browser:  key, iv = random                 ;; never leaves the browser
            ct = AES-GCM(key, iv, plaintext)
  Browser → POST /api/secrets {ct, iv, maxViews, ttlSeconds}   ;; NO key
  Server:   id = random256
            store[ SHA-256(id) ] = {ct, iv, maxViews, views:0, expiresAt, createdAt}
  Server → { id, expiresAt }
  Browser:  link = origin + "/s/" + id + "#" + key             ;; shown to creator once

REVEAL
  Recipient opens link → SPA loads at /s/:id   (#key stays in the browser)
  Browser → GET /api/secrets/:id          ;; PEEK: exists? views left? expiry?  (no consume)
  UI: "You've received a secret.  [ Reveal ]  (uses 1 of N views)"
  User clicks Reveal:
  Browser → POST /api/secrets/:id/reveal
  Server:   UPDATE secrets SET views = views + 1
            WHERE id_hash = ? AND views < max_views AND expires_at > :now
            RETURNING ciphertext, iv             ;; atomic burn — no race
            (on final allowed view → destroy ciphertext, write tombstone)
  Server → { ciphertext, iv }   or   410 Gone
  Browser:  plaintext = AES-GCM-decrypt(key_from_fragment, iv, ct) → display
```

### 5.1 Two correctness details
- **Peek/Reveal split — defuses link-preview burn.** Messaging/email clients (Slack, iMessage, Outlook) auto-fetch link previews. A non-consuming **`GET` peek** (never returns ciphertext) plus a deliberate **`POST .../reveal`** consume means automated previews cannot burn a secret — only the human's click does.
- **Atomic burn.** The consume is a single conditional `UPDATE … RETURNING` inside a transaction. Under a race, exactly one request crosses the `views < max_views` threshold. On the final allowed view the ciphertext is destroyed immediately; a short-lived tombstone row remains so a returning recipient sees "already viewed" until the sweep removes it.

## 6. Data model (SQLite)

Table `secrets`:

| Column | Type | Notes |
|---|---|---|
| `id_hash` | TEXT PRIMARY KEY | `SHA-256(raw id)`, hex |
| `ciphertext` | BLOB | AES-GCM output incl. tag; **nulled on burn** |
| `iv` | BLOB | 12 bytes; nulled on burn |
| `max_views` | INTEGER NOT NULL | default 1, range 1–10 |
| `views` | INTEGER NOT NULL | default 0 |
| `expires_at` | INTEGER NOT NULL | unix ms |
| `created_at` | INTEGER NOT NULL | unix ms |
| `consumed_at` | INTEGER NULL | set when fully burned (tombstone marker) |

- Index on `expires_at` for the expiry sweep.
- Expiry is enforced two ways: **lazily** (the `expires_at > :now` predicate on every read) and a **periodic sweep** that deletes expired rows and old tombstones (bounded interval, STANDARDS §6.4).

## 7. API surface (Hono)

Every handler follows the STANDARDS §3.1 skeleton — **validate → business logic → respond → central error handler** (no auth/tenant step; anonymous).

| Method | Route | Purpose | Success | Errors |
|---|---|---|---|---|
| `POST` | `/api/secrets` | Create | `201 { id, expiresAt }` | 400, 429 |
| `GET` | `/api/secrets/:id` | **Peek** (non-consuming) | `200 { viewsRemaining, expiresAt }` | 404, 410, 429 |
| `POST` | `/api/secrets/:id/reveal` | **Consume** (atomic burn) | `200 { ciphertext, iv }` | 404, 410, 429 |
| `GET` | `/api/health` | Liveness | `200 { status: "ok" }` | — |

### 7.1 Validation & constants (one source of truth — `server/src/constants.ts`, shared schemas in `shared/`)
- `ttlSeconds`: allow-list **1h / 1d / 7d**, default **1d**, hard cap 30d.
- `maxViews`: integer, clamp **1–10**, default **1**.
- Plaintext size cap **64 KB**, enforced on ciphertext length at the API boundary.
- Zod validates every request body and strips unknown keys (STANDARDS §1.3).

## 8. Error handling (STANDARDS §1.5)

One `handleError` helper maps typed errors → HTTP status:

| Error | Status |
|---|---|
| `ValidationError` | 400 |
| `NotFoundError` | 404 |
| `GoneError` (burned/expired) | 410 |
| `RateLimitedError` | 429 (with `Retry-After`) |
| unknown | 500 |

Structured envelope everywhere: `{ error: { code, message } }`. Errors are caught as `unknown`; internals are never forwarded to clients.

## 9. Security controls (STANDARDS §5, §12)

- **Hashed ids** + ciphertext destroyed on final view (§4.2, §5.1).
- **Rate limiting** (§5.6): in-memory token bucket per IP — creates ≈30/min, reveals ≈60/min → `429` + `Retry-After`. Single-node; a shared store is the multi-node upgrade path (§13).
- **Strict CSP** on the frontend: `default-src 'self'`, no inline scripts, `connect-src 'self'`; plus `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`.
- **No secret material in logs** (§12.2): never log ciphertext, iv, raw ids, or request bodies; structured logs reference only the hashed id.
- **Timing-safe compare** (`crypto.timingSafeEqual`) for any direct token comparison.
- **HTTPS** assumed in deployment; `http://localhost` in dev.

## 10. Frontend (React + TS + TanStack Query)

Two screens:

- **Create (`/`):** labeled textarea, TTL select, max-views select. On submit: encrypt in-browser → `POST /api/secrets` → render a copyable link plus "self-destructs after N views or {expiry}." The secret is never re-displayed.
- **View (`/s/:id`):** parse `#key` from `location.hash` → peek → render "Reveal" → on click `POST .../reveal` → decrypt → show plaintext + "this secret is now destroyed." Explicit states: **loading, not-found/expired (404/410), already-viewed, decrypt-failed (missing/wrong key), revealed**.

Implementation notes:
- Crypto isolated in `src/lib/crypto.ts` (pure, unit-tested). Link composition/parsing in `src/lib/secret-link.ts`.
- Data layer: TanStack Query hooks (`useCreateSecret`, `usePeekSecret`, `useRevealSecret`) with a centralized query-key factory (STANDARDS §3.2–3.3).
- Accessibility (§9): semantic `<form>`, labels on every field, `role="alert"` for errors, `aria-label` on icon-only buttons (e.g. copy), visible focus, sentence-case copy.

## 11. Project structure

```
src/                  React frontend
  features/secrets/     create + view screens, hooks
  lib/                  crypto.ts, secret-link.ts, api-client.ts, query-keys.ts
  __tests__/            mirror tree (STANDARDS §7.3)
server/src/           Hono API
  index.ts              app entry, middleware (CSP, rate limit), static serving
  routes/secrets.ts     create / peek / reveal
  lib/                  db.ts, store.ts, ids.ts, rate-limit.ts, errors.ts
  constants.ts          TTL allow-list, size caps, limits
  __tests__/            mirror tree
shared/               Zod API-contract schemas + inferred types (one source, both sides)
tests/                Playwright E2E
```

- Frontend stays at root; `server/` and `shared/` are added. Light npm-workspaces wiring exposes `shared`.
- Dev: Vite proxies `/api` → Hono (run via `tsx` watch). The existing `tsconfig.app.json` / `tsconfig.node.json` cover the client/server split.

## 12. Testing strategy (STANDARDS §7)

- **Backend (Vitest, node env, fresh in-memory SQLite per test):** per route — happy path, 400 validation, 404, 410, 429; **concurrent-reveal race → only `maxViews` succeed**; peek never consumes. Target ≈90% (§7.1).
- **Crypto unit:** encrypt→decrypt round-trip; wrong key fails; tampered ciphertext fails (GCM auth).
- **Frontend (Vitest + jsdom + RTL):** create flow; every view-page state; queried by role/label; API mocked.
- **E2E (Playwright, ephemeral DB per run — §7.6):** create → reveal → reload-shows-burned; expired secret; peek-doesn't-burn. Plus an **axe** a11y pass on both screens.
- **Verification gate (§7.7):** lint, build, unit, and E2E all clean before "done."

## 13. Out of scope / future extensions

- **Creator revoke link** — a second management token → `DELETE /api/secrets/:id` for early destruction. Adds a token type + UI; deferred to keep the anonymous flow lean.
- **Multi-node** — move the rate limiter and store to a shared backend (e.g. Redis) for horizontal scaling.
- **Integrity of served JS** — SRI / signed builds to harden the "trust the JS" assumption.
- **Creator passphrase** — optional second factor folded into key derivation.

## 14. STANDARDS alignment quick map

| Standard | Where addressed |
|---|---|
| §1.3 Input validation at boundaries | Zod schemas in `shared/`, strip unknown keys (§7.1) |
| §1.5 Error handling | Central `handleError`, structured envelope (§8) |
| §5.4 Secrets & tokens | Hashed ids, baked-in expiry, single-use (§4.2, §6) |
| §5.6 Rate limiting | Per-IP token bucket (§9) |
| §6.4 Bounded background work | Periodic sweep with bounded interval (§6) |
| §7 Testing | Coverage targets, race test, E2E, axe (§12) |
| §9 Accessibility | Semantic form, labels, alerts, focus (§10) |
| §12.2 Logging | No secret material in logs (§9) |
