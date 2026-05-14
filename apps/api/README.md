**SoroTrace Backend API**

The NestJS backend that powers SoroTrace. It handles contract and transaction indexing, serves the REST and WebSocket API consumed by the frontend, runs the alert evaluation engine, and orchestrates the static analysis pipeline.

---

## Responsibilities

- **Indexer** — continuously polls Stellar Horizon and the Soroban RPC to index deployed contracts, invocations, storage state, and events
- **REST API** — serves contract, transaction, alert, and scan data to the frontend and public consumers
- **WebSocket** — streams real-time transaction events and alert triggers to connected clients
- **Alert engine** — evaluates configured alert rules against incoming contract activity and dispatches notifications
- **Scanner** — orchestrates static analysis jobs against submitted contract source or WASM

---

## Stack

| Technology | Purpose |
|------------|---------|
| [NestJS](https://nestjs.com/) | Backend framework — modular, TypeScript-first |
| [Prisma](https://www.prisma.io/) | ORM — type-safe database access and migrations |
| [PostgreSQL](https://www.postgresql.org/) | Primary data store |
| [Redis](https://redis.io/) | Job queue backend and response caching |
| [BullMQ](https://bullmq.io/) | Background job queue — indexing, alerts, scans |
| [Socket.io](https://socket.io/) | WebSocket server for real-time event streaming |
| [Stellar SDK](https://stellar.github.io/js-stellar-sdk/) | Stellar network interactions |

---

## Project Structure

```
apps/api/
├── src/
│   ├── app.module.ts             Root module
│   ├── main.ts                   Entry point
│   │
│   ├── indexer/                  Background workers
│   │   ├── contract.indexer.ts   Indexes deployed contracts
│   │   ├── transaction.indexer.ts Indexes invocations and events
│   │   └── indexer.module.ts
│   │
│   ├── contracts/                Contract Explorer module
│   │   ├── contracts.controller.ts
│   │   ├── contracts.service.ts
│   │   ├── contracts.module.ts
│   │   └── dto/
│   │
│   ├── debugger/                 Transaction Debugger module
│   │   ├── debugger.controller.ts
│   │   ├── debugger.service.ts
│   │   ├── debugger.module.ts
│   │   └── dto/
│   │
│   ├── monitor/                  Alert engine module
│   │   ├── monitor.controller.ts
│   │   ├── monitor.service.ts
│   │   ├── alert.evaluator.ts
│   │   ├── notification.service.ts
│   │   ├── monitor.module.ts
│   │   └── dto/
│   │
│   ├── scanner/                  Static analysis module
│   │   ├── scanner.controller.ts
│   │   ├── scanner.service.ts
│   │   ├── scanner.module.ts
│   │   └── dto/
│   │
│   ├── auth/                     JWT authentication
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── auth.module.ts
│   │
│   └── common/                   Guards, interceptors, filters, pipes
│
├── prisma/
│   ├── schema.prisma             Database schema
│   └── migrations/
│
├── test/
│   ├── unit/
│   └── e2e/
│
├── .env.example
├── Dockerfile
├── nest-cli.json
├── tsconfig.json
└── package.json
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/sorotrace"

# Redis
REDIS_URL="redis://localhost:6379"

# Stellar
STELLAR_NETWORK="testnet"                          # testnet | mainnet
STELLAR_HORIZON_URL="https://horizon-testnet.stellar.org"
STELLAR_RPC_URL="https://soroban-testnet.stellar.org"

# Auth
JWT_SECRET="your-jwt-secret"
JWT_EXPIRY="7d"

# Notifications
SENDGRID_API_KEY="your-sendgrid-key"
TELEGRAM_BOT_TOKEN="your-telegram-bot-token"

# App
PORT=3001
NODE_ENV="development"
```

---

## Database

SoroTrace uses Prisma for database management.

```bash
# Run all pending migrations
pnpm db:migrate

# Create a new migration after schema changes
pnpm db:migrate:create --name your_migration_name

# Open Prisma Studio (database browser)
pnpm db:studio

# Reset the database (drops all data)
pnpm db:reset
```

---

## API Modules

### Contracts (`/contracts`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/contracts` | Search and list indexed contracts |
| `GET` | `/contracts/:address` | Get contract profile by address |
| `GET` | `/contracts/:address/invocations` | Paginated invocation history |
| `GET` | `/contracts/:address/storage` | Current storage state |
| `GET` | `/contracts/:address/events` | Event log |
| `GET` | `/contracts/:address/callers` | Caller graph data |
| `POST` | `/contracts/:address/verify` | Submit source for verification |

### Debugger (`/debugger`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/debugger/tx/:hash` | Full parsed transaction breakdown |
| `POST` | `/debugger/simulate` | Simulate a transaction without broadcasting |

### Monitor (`/monitor`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/monitor/alerts` | List configured alert rules |
| `POST` | `/monitor/alerts` | Create a new alert rule |
| `PATCH` | `/monitor/alerts/:id` | Update an alert rule |
| `DELETE` | `/monitor/alerts/:id` | Delete an alert rule |
| `GET` | `/monitor/alerts/:id/history` | Alert trigger history |

### Scanner (`/scanner`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/scanner/scan` | Submit contract source or WASM for analysis |
| `GET` | `/scanner/scan/:id` | Get scan results by scan ID |
| `GET` | `/scanner/rules` | List all available vulnerability rules |

---

## Running

```bash
# Development with hot reload
pnpm dev

# Production build
pnpm build
pnpm start:prod

# Run tests
pnpm test
pnpm test:e2e
pnpm test:cov
```

---

## WebSocket Events

Connect to the WebSocket server at `ws://localhost:3001`.

| Event | Direction | Payload |
|-------|-----------|---------|
| `subscribe:contract` | Client → Server | `{ address: string }` |
| `unsubscribe:contract` | Client → Server | `{ address: string }` |
| `contract:invocation` | Server → Client | `ParsedTransaction` |
| `alert:triggered` | Server → Client | `AlertEvent` |
| `indexer:status` | Server → Client | `{ status, lastLedger }` |