# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server with tsx watch
npm run build        # Compile TypeScript to dist/
npm run start        # Run compiled output

npm run test         # Run all tests
npm run test:unit    # Unit tests only
npm run test:integration  # Integration tests only (requires DB)
npm run test:watch   # Watch mode
npm run test:coverage
```

Integration tests require a `.env.test` file. If the DB is unavailable, integration tests are skipped automatically via `SKIP_DB_INTEGRATION=1`.

To run a single test file:
```bash
npx vitest run tests/modules/auth/01_auth.service.unit.test.ts
```

## Architecture

**Dependency injection via factory functions** — no DI container library. `src/app/container.ts` (`buildContainer`) manually wires every repo → service → controller → router. `src/app/testContainer.ts` mirrors this for tests and exports `fakeAuthenticate` + `createTestApp`.

**Module structure** — every feature under `src/modules/<name>/` follows:
- `*.repo.ts` — raw SQL queries against PostgreSQL (`pg` pool)
- `*.service.ts` — business logic, calls repo and emits domain events
- `*.controller.ts` — HTTP request/response, calls service
- `*.router.ts` — Express routes + middleware wiring
- `*.schema.ts` — Zod validation schemas
- `index.ts` — re-exports all `make*` factory functions

**Infrastructure** (`src/infra/`):
- `db/db.ts` — PostgreSQL pool via `pg`
- `redis/redis.ts` — Redis client
- `events/` — typed EventEmitter per domain (office, parking, team, user)
- `websocket/` — Socket.IO server + per-domain broadcasters that listen to domain events and push to connected clients
- `queue/` — BullMQ queues + workers for delayed no-show/checkout jobs (office and parking)
- `mail/` — Nodemailer/Resend email service
- `gemini/` — Google Generative AI client (used by chat module)

**Real-time flow**: Service emits domain event → broadcaster (`infra/websocket/broadcasters/`) listens and calls `io.emit` → client receives WebSocket update.

**Queue flow**: On reservation, a delayed BullMQ job is enqueued. The worker fires at check-in/checkout time and calls repo methods directly.

**Chat module** (`src/modules/chat/`) implements an AI assistant using Gemini with tool use. Resources (`resources/`) provide context data; tools (`tools/`) are callable actions the model can invoke.

**Auth**: JWT stored in HTTP-only cookie. `authentication.middleware.ts` validates the token and attaches `req.user`. `authorization.middleware.ts` checks roles.

**Error handling**: Throw `AppError` (from `src/shared/errors/AppError.ts`) anywhere; `errorHandler` middleware catches and formats the response.

## Environment Variables

`.env` for dev, `.env.test` for tests. Key variables:
```
PORT
DATABASE_URL          # PostgreSQL connection string
JWT_SECRET
SMTP_EMAIL / SMTP_PASSWORD
REDIS_URL
GEMINI_API_KEY
```

## Testing Conventions

- Files named `*.unit.test.ts` test services/schemas with mocked repos
- Files named `*.integration.test.ts` hit a real MySQL test DB (seeded via `tests/utils/seed.util.ts`)
- Integration tests authenticate via `x-test-user` header (injected by `fakeAuthenticate` middleware), not real JWT
- Tests are numbered `00_` (schema), `01_` (service), `02_` (integration) within each module folder
