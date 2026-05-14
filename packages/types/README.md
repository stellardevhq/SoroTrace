**Shared TypeScript interfaces for the SoroTrace monorepo.**

This package is the single source of truth for all data shapes used across `apps/api` and `apps/web`. Both apps import from this package — no duplicated type definitions, no drift between what the API returns and what the frontend expects.

---

## Usage

```typescript
import type {
  SorobanContract,
  ParsedTransaction,
  StorageDiff,
  AlertRule,
  ScanResult,
} from '@sorotrace/types';
```

---

## Exported Types

### Contracts

```typescript
// A deployed Soroban contract
interface SorobanContract {
  address: string;
  deployerAddress: string;
  deploymentTxHash: string;
  deploymentLedger: number;
  wasmHash: string;
  verificationStatus: VerificationStatus;
  verifiedSourceUrl?: string;
  firstSeenAt: Date;
  invocationCount: number;
  lastInvokedAt?: Date;
}

type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'failed';
```

### Transactions

```typescript
// A fully parsed Soroban transaction
interface ParsedTransaction {
  hash: string;
  ledger: number;
  createdAt: Date;
  contractAddress: string;
  callerAddress: string;
  functionName: string;
  arguments: DecodedValue[];
  result: DecodedValue | null;
  status: 'success' | 'failed';
  failureReason?: string;
  callTrace: CallTraceNode[];
  storageDiff: StorageDiff;
  events: ContractEvent[];
  resources: ResourceUsage;
  feePaid: string;
}

interface CallTraceNode {
  depth: number;
  contractAddress: string;
  functionName: string;
  arguments: DecodedValue[];
  result: DecodedValue | null;
  status: 'success' | 'failed';
  children: CallTraceNode[];
}
```

### Storage

```typescript
// Before/after diff of all storage changes in a transaction
interface StorageDiff {
  instance: StorageEntry[];
  persistent: StorageEntry[];
  temporary: StorageEntry[];
}

interface StorageEntry {
  key: string;
  keyDecoded: DecodedValue;
  before: DecodedValue | null;    // null if entry was created
  after: DecodedValue | null;     // null if entry was deleted
  operation: 'created' | 'updated' | 'deleted' | 'read';
  ttlWarning?: TtlWarning;
}

interface TtlWarning {
  currentTtl: number;
  ledgersUntilArchival: number;
  severity: 'low' | 'medium' | 'high';
}
```

### Alerts

```typescript
// A configured monitoring alert rule
interface AlertRule {
  id: string;
  contractAddress: string;
  name: string;
  type: AlertRuleType;
  condition: AlertCondition;
  channels: NotificationChannel[];
  enabled: boolean;
  createdAt: Date;
}

type AlertRuleType =
  | 'volume_spike'
  | 'failure_rate'
  | 'unknown_caller'
  | 'storage_change'
  | 'large_transfer'
  | 'event_trigger'
  | 'ttl_expiry';

interface AlertEvent {
  id: string;
  ruleId: string;
  triggeredAt: Date;
  transactionHash?: string;
  detail: string;
  acknowledged: boolean;
}

type NotificationChannel =
  | { type: 'email'; address: string }
  | { type: 'webhook'; url: string }
  | { type: 'telegram'; chatId: string };
```

### Scanner

```typescript
// Result of a static analysis scan
interface ScanResult {
  id: string;
  contractAddress?: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  findings: Finding[];
  summary: ScanSummary;
  createdAt: Date;
  completedAt?: Date;
}

interface Finding {
  ruleId: string;
  title: string;
  description: string;
  severity: Severity;
  location?: CodeLocation;
  remediation: string;
}

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

interface ScanSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}
```

---

## Adding Types

Add new interfaces to the relevant file in `src/`. Export from `src/index.ts`. Both apps pick up the change automatically — no publishing step required within the monorepo.

```
packages/types/src/
├── contract.ts
├── transaction.ts
├── storage.ts
├── alert.ts
├── scan.ts
├── common.ts       Shared primitives (DecodedValue, ResourceUsage, etc.)
└── index.ts        Re-exports everything
```