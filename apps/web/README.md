**SoroTrace Frontend**

The Next.js 14 frontend for SoroTrace. Provides the contract explorer, transaction debugger, monitoring dashboard, and static analysis UI as a fast, server-rendered web application.

---

## Stack

| Technology | Purpose |
|------------|---------|
| [Next.js 14](https://nextjs.org/) (App Router) | Framework — SSR for public contract pages, client-side for interactive tools |
| [TypeScript](https://www.typescriptlang.org/) | Type safety throughout |
| [Tailwind CSS](https://tailwindcss.com/) | Utility-first styling |
| [shadcn/ui](https://ui.shadcn.com/) | Accessible component primitives |
| [Recharts](https://recharts.org/) | Charts — transaction volume, resource usage, invocation timelines |
| [React Flow](https://reactflow.dev/) | Interactive caller graph visualisation |
| [Prism.js](https://prismjs.com/) | Syntax highlighting for Rust source and XDR output |
| [Socket.io client](https://socket.io/docs/v4/client-api/) | Real-time monitoring feed from the backend |

---

## Project Structure

```
apps/web/
├── app/
│   ├── layout.tsx                    Root layout
│   ├── page.tsx                      Home / search landing
│   │
│   ├── (explorer)/                   Contract Explorer routes
│   │   ├── search/
│   │   │   └── page.tsx              Contract search results
│   │   └── contract/
│   │       └── [address]/
│   │           ├── page.tsx          Contract profile
│   │           ├── invocations/
│   │           │   └── page.tsx      Invocation history
│   │           ├── storage/
│   │           │   └── page.tsx      Storage state viewer
│   │           ├── events/
│   │           │   └── page.tsx      Event log
│   │           └── callers/
│   │               └── page.tsx      Caller graph
│   │
│   ├── (debugger)/                   Transaction Debugger routes
│   │   └── tx/
│   │       └── [hash]/
│   │           └── page.tsx          Transaction detail + debugger
│   │
│   ├── (monitor)/                    Monitor dashboard routes
│   │   ├── page.tsx                  Alert overview
│   │   ├── new/
│   │   │   └── page.tsx              New alert rule builder
│   │   └── [id]/
│   │       └── page.tsx              Alert rule detail + history
│   │
│   ├── (scanner)/                    Static analyser routes
│   │   ├── page.tsx                  Scan submission
│   │   └── results/
│   │       └── [scanId]/
│   │           └── page.tsx          Scan report viewer
│   │
│   └── api/                          Next.js route handlers (server-side API calls)
│       ├── contracts/
│       ├── debugger/
│       ├── monitor/
│       └── scanner/
│
├── components/
│   ├── explorer/                     Contract Explorer components
│   ├── debugger/                     Transaction Debugger components
│   ├── monitor/                      Monitor dashboard components
│   ├── scanner/                      Scanner report components
│   └── shared/                       Shared layout and navigation components
│
├── hooks/                            Custom React hooks
├── lib/                              Utility functions, API client
├── public/                           Static assets
├── .env.example
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

---

## Rendering Strategy

The App Router allows per-route rendering decisions. SoroTrace uses this deliberately:

| Route | Strategy | Reason |
|-------|----------|--------|
| Contract profile pages | Server-rendered (SSR) | SEO — contract pages should be indexed by search engines |
| Transaction debugger | Client-side | Highly interactive — step-through, live state, simulations |
| Monitor dashboard | Client-side + WebSocket | Real-time alert feed requires live connection |
| Scanner results | Server-rendered | Static report, shareable URL |
| Home / search | Server-rendered | Fast initial load, SEO |

---

## Environment Variables

Copy `.env.example` to `.env.local`:

```env
# Backend API
NEXT_PUBLIC_API_URL="http://localhost:3001"
NEXT_PUBLIC_WS_URL="ws://localhost:3001"

# Stellar
NEXT_PUBLIC_STELLAR_NETWORK="testnet"        # testnet | mainnet
NEXT_PUBLIC_STELLAR_EXPLORER_URL="https://stellar.expert/explorer/testnet"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## Running

```bash
# Development with hot reload
pnpm dev

# Production build
pnpm build

# Start production server
pnpm start

# Run tests
pnpm test

# Lint
pnpm lint
```

---

## Key Pages

### Contract Profile (`/contract/[address]`)
Server-rendered. Fetches contract metadata, verification status, and summary stats at request time. Tabs for invocation history, storage state, events, and caller graph load on the client after initial render.

### Transaction Debugger (`/tx/[hash]`)
Client-rendered. Fetches the parsed transaction from the API and renders the step-through call trace, storage diff, event timeline, and resource profiling panels interactively.

### Monitor Dashboard (`/monitor`)
Client-rendered with WebSocket connection. Displays active alert rules and fires toast notifications in real time when alerts are triggered by the backend.

### Scanner (`/scanner`)
Split: the submission form is client-rendered (file upload, form state). The results page (`/scanner/results/[scanId]`) is server-rendered for shareability.