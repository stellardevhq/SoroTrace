# SoroTrace

[![CI](https://github.com/stellardevhq/SoroTrace/actions/workflows/ci.yml/badge.svg)](https://github.com/stellardevhq/SoroTrace/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Soroban Contract Intelligence - Explorer, Debugger, Monitor, and Static Analyser for the Stellar ecosystem.**

SoroTrace is an open-source developer platform that gives every Soroban developer the observability layer that currently does not exist on Stellar. Explore deployed contracts, debug transactions step-by-step, monitor production activity in real time, and scan for Soroban-specific vulnerabilities - all in one place.

> Built by [stellardevhq](https://github.com/stellardevhq)

---

## What It Does

| Layer | Name | Description |
|-------|------|-------------|
| 1 | **Contract Explorer** | Search and inspect deployed Soroban contracts - source code, ABI, invocation history, storage state, caller graph |
| 2 | **Transaction Debugger** | Step-through breakdown of any Soroban transaction - call trace, storage diff, events, resource profiling, failure analysis |
| 3 | **Contract Monitor** | Real-time alerts on contract activity - volume spikes, failed calls, unknown callers, state changes, TTL warnings |
| 4 | **Static Analyser** | Automated scanning for Soroban-specific vulnerabilities - state archival mishandling, auth bypass patterns, storage misuse |
 
> **Glossary for new contributors**
> - **Soroban** — the smart-contract platform built into the Stellar blockchain.
> - **XDR** — the binary serialisation format Stellar uses to encode transactions and contract data.
> - **TTL** — "time-to-live"; Soroban contract storage entries expire unless explicitly extended.
> - **ABI** — "application binary interface"; the published description of a contract's callable functions and data types.
 
---

## Repository Structure

This is a [Turborepo](https://turbo.build/repo) monorepo managed with [pnpm workspaces](https://pnpm.io/workspaces).

```
sorotrace/
├── apps/
│   ├── api/                  NestJS backend - indexer, REST + WebSocket API, alert engine
│   └── web/                  Next.js 14 frontend - explorer, debugger, monitor, scanner UI
├── packages/
│   ├── types/                Shared TypeScript interfaces across all apps
│   ├── stellar-sdk-utils/    Stellar SDK + Horizon API wrappers
│   ├── soroban-parser/       Soroban XDR decoding and storage tier parsing
│   ├── scanner-rules/        Static analysis vulnerability rule definitions
│   └── ui/                   Shared React component library
├── turbo.json
├── package.json              pnpm workspace root
└── .github/
    └── workflows/            CI/CD pipelines
```

---

## Getting Started

### Prerequisites

Before setting up the project locally, make sure you have the following installed:
 
| Tool | Version | Install |
| ---- | ------- | ------- |
| [Node.js](https://nodejs.org/) | 22 (see `.nvmrc`) | [nodejs.org](https://nodejs.org/) or [nvm](https://github.com/nvm-sh/nvm) |
| [pnpm](https://pnpm.io/) | 10.4.1 | `npm install -g pnpm@10.4.1` |
| [Docker](https://www.docker.com/) + Docker Compose | any recent version | [docker.com](https://www.docker.com/get-started/) |
| [Git](https://git-scm.com/) | any recent version | [git-scm.com](https://git-scm.com/) |
 
> **Tip:** If you use [nvm](https://github.com/nvm-sh/nvm), run `nvm use` from the repo root to automatically switch to the correct Node version.


## Local Setup
 
Follow these steps in order.
 
### 1. Clone the repository
 
```bash
git clone https://github.com/stellardevhq/SoroTrace.git
cd SoroTrace
```
 
### 2. Install dependencies
 
```bash
pnpm install
```
 
This installs packages for every app and shared package in one command.
 
### 3. Start local infrastructure
 
SoroTrace's backend needs a PostgreSQL database and a Redis instance. Docker Compose starts both:
 
```bash
docker compose up -d
```
 
Default connection details (used in the example `.env` files below):
 
| Service    | Host        | Port | Credentials             |
| ---------- | ----------- | ---- | ----------------------- |
| PostgreSQL | `localhost` | 5432 | `user` / `password`, db `sorotrace` |
| Redis      | `localhost` | 6379 | no password             |
 
### 4. Set up environment variables
 
Each app ships an example environment file. Copy them and edit any values that differ from your local setup:
 
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```
 
### 5. Run database migrations
 
This creates the database schema:
 
```bash
pnpm --filter api db:migrate
```
 
### 6. Start the development servers
 
```bash
pnpm dev
```
 
This starts all apps and packages in parallel with hot-reload. You can also start a single app:
 
```bash
pnpm --filter api dev   # backend only  → http://localhost:3001
pnpm --filter web dev   # frontend only → http://localhost:3000
```
---

## Available Scripts
 
Run these from the repository root:
 
| Command          | What it does                                             |
| ---------------- | -------------------------------------------------------- |
| `pnpm dev`       | Start all apps in development mode with hot-reload       |
| `pnpm build`     | Build all apps and packages for production               |
| `pnpm typecheck` | Run TypeScript type checking across the entire monorepo  |
| `pnpm lint`      | Lint all apps and packages with ESLint                   |
| `pnpm test`      | Run all test suites                                      |
| `pnpm format`    | Format all files with Prettier                           |
| `pnpm clean`     | Remove all build artefacts and `node_modules` directories |
 
Turborepo runs tasks in the correct dependency order automatically — you do not need to `cd` into individual packages.

## Apps

| App | Description | README |
| --- | ----------- | ------ |
| `apps/api` | NestJS backend — data indexer, REST and WebSocket API, alert engine | [apps/api/README.md](apps/api/README.md) |
| `apps/web` | Next.js 14 frontend — explorer, debugger, monitor, and scanner UI | [apps/web/README.md](apps/web/README.md) |

## Packages

| Package | Description | README |
|---------|-------------|--------|
| `packages/types` | Shared TypeScript interfaces | [packages/types/README.md](./packages/types/README.md) |
| `packages/stellar-sdk-utils` | Stellar SDK and Horizon wrappers | [packages/stellar-sdk-utils/README.md](./packages/stellar-sdk-utils/README.md) |
| `packages/soroban-parser` | Soroban XDR and storage decoding | [packages/soroban-parser/README.md](./packages/soroban-parser/README.md) |
| `packages/scanner-rules` | Static analysis rule definitions | [packages/scanner-rules/README.md](./packages/scanner-rules/README.md) |
| `packages/ui` | Shared React component library | [packages/ui/README.md](./packages/ui/README.md) |

---

## Scripts

Run from the root of the monorepo:

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in development mode with hot reload |
| `pnpm build` | Build all apps and packages |
| `pnpm test` | Run all test suites |
| `pnpm lint` | Lint all apps and packages |
| `pnpm typecheck` | Run TypeScript type checking across the monorepo |
| `pnpm format` | Format all files with Prettier |
| `pnpm clean` | Remove all build artifacts and node_modules |

---

## Tech Stack

**Backend (`apps/api`)** - NestJS · TypeScript · Prisma · PostgreSQL · Redis · BullMQ · Socket.io · Stellar SDK

**Frontend (`apps/web`)** - Next.js 14 · TypeScript · Tailwind CSS · shadcn/ui · Recharts · React Flow

**Infrastructure** - Turborepo · pnpm · Docker · GitHub Actions · Railway · Vercel

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

---

## Ecosystem

SoroTrace is part of the [stellardevhq](https://github.com/stellardevhq) family of open-source developer tools for the Stellar ecosystem.

| Project | Description |
|---------|-------------|
| [sorotrace](https://github.com/stellardevhq/sorotrace) | Soroban contract intelligence platform (this repo) |
| [sorotrace-action](https://github.com/stellardevhq/sorotrace-action) | GitHub Action for CI static analysis |

---

## License

[MIT](./LICENSE) - free to use, fork, and build on.
