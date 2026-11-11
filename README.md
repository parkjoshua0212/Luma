# Luma

A Node.js/Express + PostgreSQL REST API for practicing language conversation with an AI partner (Google Gemini), with inline grammar correction.

**Live API docs (Swagger):** https://luma-api-djcb.onrender.com/api-docs

> **Heads-up:** the API runs on Render's free tier, which sleeps when idle. The first request after a quiet period can take **~30–60 seconds** while the instance wakes up. After that, responses are normal.

The frontend lives in a separate repo: [Luma Web](https://github.com/parkjoshua0212/luma-web).

## Contents
- [What it does](#what-it-does)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [CI/CD](#cicd)
- [Security](#security)
- [API overview](#api-overview)
- [Running locally](#running-locally)
- [License](#license)

## What it does
Users register, start a conversation in **formal** or **casual** mode, and chat with a Gemini-backed partner whose tone follows the mode. Each message also gets a grammar check in parallel. If the check finds a mistake, the correction and explanation are stored on the user's message. A separate endpoint checks any single sentence on its own.

## Tech stack
| Area | Tools |
|---|---|
| Runtime | Node.js 24, Express 5 (ES modules) |
| Database | PostgreSQL via `pg` with raw parameterized SQL (no ORM); Neon in production |
| Auth | JWT (`jsonwebtoken`, 7-day expiry), `bcrypt` password hashing |
| AI | Google Gemini via `@google/genai` (`gemini-3.6-flash`) |
| Security | Helmet, CORS origin allowlist, `express-rate-limit` |
| Docs | Swagger / OpenAPI (`swagger-jsdoc`, `swagger-ui-express`) |
| Testing & lint | Jest, Supertest, ESLint |
| CI/CD & hosting | GitHub Actions, Render (via deploy hook) |

## Architecture

```mermaid
flowchart LR
    Client["Client<br/>(web app / curl / Swagger UI)"] -->|HTTPS + JWT| API["Express API<br/>(Render)"]
    API -->|parameterized SQL| DB[("PostgreSQL<br/>(Neon)")]
    API -->|chat reply + grammar check| Gemini["Google Gemini API"]

    subgraph CICD["CI/CD"]
        GHA["GitHub Actions<br/>lint + tests"] -->|on success, push to main| Hook["Render deploy hook"]
    end
    Hook -->|triggers deploy| API
```

**Code layout**

| Path | Purpose |
|---|---|
| `index.js` | Loads env and starts the server |
| `app.js` | Builds the Express app (Helmet, CORS, routes, `/health`, `/api-docs`); exported so tests can import it without opening a port |
| `routes/` | Route definitions and Swagger annotations |
| `controllers/` | Request handling and SQL |
| `lib/gemini.js` | Gemini client, system prompts, retry logic |
| `middleware/authMiddleware.js` | JWT verification (`requireAuth`) |
| `utils/validators.js` | Password, mode, and input-length checks |
| `db/schema.sql` | Tables: `users`, `conversations`, `messages` (deletes cascade) |

## CI/CD
The workflow is in [`.github/workflows/ci.yml`](.github/workflows/ci.yml). It runs on every push and pull request to `main`.

1. **`test` job:** starts a Postgres 18 service container, then runs `npm ci`, `npm run lint` (ESLint), and `npm test` (Jest + Supertest).
2. **`deploy` job:** declared with `needs: test`, so it only runs after the test job passes, and only on pushes (never on PRs). It calls the Render deploy hook stored in the `RENDER_DEPLOY_HOOK_URL` secret.

If lint or any test fails, nothing deploys.

**Test suite: 48 tests**

| Suite | Tests | What runs |
|---|---|---|
| Unit (`tests/*.test.js`) | 36 | Validators, JWT middleware, and auth, conversation, and health routes, with the database mocked |
| Integration (`tests/integration/`) | 12 | Runs against a real Postgres. The schema is rebuilt from `db/schema.sql` before the run, and Gemini is mocked. Covers register/login, IDOR checks, sending a message, `/health`, and the login rate limit returning 429. |

## Security
- **User-scoped queries (IDOR protection).** Every conversation query filters on both the conversation `id` and the `user_id` from the verified JWT (`WHERE id = $1 AND user_id = $2`). Messages are only read or written after that ownership check passes. Another user's conversation returns `404`, so its existence isn't revealed. Integration tests check that a second user gets `404` on GET, DELETE, and send-message, that the conversation survives the DELETE attempt, and that Gemini is never called.
- **Auth rate limiting.** `POST /api/auth/register` and `POST /api/auth/login` share a limiter of **10 requests per 15 minutes per IP**, which can be overridden with `AUTH_RATE_LIMIT_MAX`. Going over the limit returns `429`. `trust proxy` is set to `3` to match Render's proxy chain, so clients can't spoof `X-Forwarded-For` to get around the limit.
- **Password policy.** Passwords must be strings of **at least 8 characters**. They're hashed with bcrypt (cost 10), and login returns the same `Invalid credentials` message whether the email is unknown or the password is wrong.
- **Failed AI calls.**
  - Gemini `503` (overloaded) is retried up to 2 times, with backoff of 1s and then 2s.
  - Gemini `429` (quota) fails fast and is returned to the client as `429` with a "daily AI limit" message.
  - The chat reply and grammar check run in parallel with `Promise.allSettled`, so one failing doesn't cancel the other. A failed grammar check is non-fatal: the message is saved without a correction.
  - If the chat reply fails, the user's message (and any grammar correction that succeeded) is still saved. The API responds with `502` (or `429` for quota) and includes the saved `userMessage`, so the client can retry without losing input.
  - If Gemini returns grammar JSON that can't be parsed, the call fails with a clean `500` and doesn't crash the server.
- **Other hardening.**
  - Inputs are length-capped: 2000 characters for chat messages, 500 for grammar sentences.
  - System prompts tell the model to treat user text as practice input, not instructions.
  - Helmet sets the security headers.
  - CORS only accepts browser origins on the allowlist (`ALLOWED_ORIGINS`).
  - All SQL is parameterized.

## API overview
There are **9 API endpoints** in three groups, plus two utility routes. The full interactive docs are at [`/api-docs`](https://luma-api-djcb.onrender.com/api-docs).

**Auth: 3 endpoints**
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/api/auth/register` | Create a user and return a JWT (rate limited) | No |
| POST | `/api/auth/login` | Log in and return a JWT (rate limited) | No |
| GET | `/api/auth/me` | Get the current user | Yes |

**Conversations: 5 endpoints**
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/api/conversations/start` | Start a conversation (`mode`: `formal` or `casual`) | Yes |
| GET | `/api/conversations` | List your conversations | Yes |
| GET | `/api/conversations/:id` | Get a conversation and its messages | Yes |
| DELETE | `/api/conversations/:id` | Delete a conversation (its messages cascade) | Yes |
| POST | `/api/conversations/:id/message` | Send a message; returns the AI reply plus any grammar correction | Yes |

**AI: 1 endpoint**
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/api/ai/correct` | Correct one sentence and explain the fix | Yes |

**Utility routes**
| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Liveness text |
| GET | `/health` | Checks database connectivity (`200` or `500`) |

## Running locally

**Prerequisites:** Node.js 24, a PostgreSQL database, and a Gemini API key.

```bash
git clone https://github.com/parkjoshua0212/Luma.git
cd Luma
npm install
cp .env.example .env        # then fill in the values
psql "$DATABASE_URL" -f db/schema.sql
npm run dev                 # http://localhost:3000/api-docs
```

`.env.example` lists every environment variable the app reads:

```bash
DATABASE_URL=          # Postgres connection string
DB_SSL=                # "false" for a local Postgres without SSL; otherwise SSL is on
JWT_SECRET=            # secret for signing JWTs
GEMINI_API_KEY=        # Google Gemini API key
ALLOWED_ORIGINS=       # optional, comma-separated CORS origins (default: localhost:5173, localhost:3000)
AUTH_RATE_LIMIT_MAX=   # optional, auth attempts per 15 min per IP (default: 10)
PORT=                  # optional (default: 3000)
```

`node db/test-connection.js` checks that the database connection works.

**Tests and lint**

```bash
npm run lint
npm run test:unit          # 36 tests, no database needed
npm run test:integration   # 12 tests, needs Postgres on localhost:5432
npm test                   # both
```

The integration tests use hardcoded settings from `tests/integration/env.js`: `postgres://postgres:postgres@localhost:5432/luma_test`, with SSL off and a mocked Gemini, so they can never reach production services. Before running, they **drop and recreate** the `users`, `conversations`, and `messages` tables in that database. Don't point it at a database you care about.

## License
MIT. See [LICENSE](./LICENSE).
