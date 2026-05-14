**Static analysis vulnerability rule definitions for SoroTrace.**

Contains the metadata, severity classifications, and remediation guidance for every vulnerability rule in SoroTrace's static analyser. The scanner engine in `apps/api` loads rules from this package and applies them against submitted contract source or WASM.

Keeping rules separate from the engine means adding or updating vulnerability rules does not require touching the scanner infrastructure — and community contributors can propose new rules without needing to understand the engine internals.

---

## Usage

```typescript
import { getAllRules, getRuleById, getRulesBySeverity } from '@sorotrace/scanner-rules';
import type { ScanRule, Severity } from '@sorotrace/types';

// Get all available rules
const rules = getAllRules();

// Get a specific rule
const rule = getRuleById('ST-001');

// Get all critical and high severity rules
const highPriorityRules = getRulesBySeverity(['critical', 'high']);
```

---

## Current Rule Set

### Critical

| Rule ID | Title | Description |
|---------|-------|-------------|
| `ST-001` | Authorization Bypass | Missing or incorrect `require_auth` calls that allow unpermissioned access to privileged contract functions |
| `ST-002` | Unchecked Auth Result | `require_auth` return value ignored — authorization failures silently continue execution |

### High

| Rule ID | Title | Description |
|---------|-------|-------------|
| `ST-010` | State Archival Mishandling | Contract reads persistent storage without first checking if the entry exists — fails silently when the entry has been archived |
| `ST-011` | Missing TTL Extension | Contract writes to persistent storage but never calls `extend_ttl` — data will be archived after its initial TTL expires |
| `ST-012` | Temporary Storage Misuse | Contract stores data intended to persist across transactions in temporary storage, which is cleared every ledger |
| `ST-013` | Archived Entry Re-creation Race | Contract deletes and recreates persistent entries in a way that creates a window where state is unavailable |

### Medium

| Rule ID | Title | Description |
|---------|-------|-------------|
| `ST-020` | Unbounded Storage Growth | Contract accumulates persistent or instance storage entries in a loop or unbounded map without a corresponding removal mechanism |
| `ST-021` | Unsafe Integer Arithmetic | Integer operations that may overflow or underflow in edge cases not caught by Rust's overflow checks in release mode |
| `ST-022` | Unprotected Admin Function | Functions that modify critical contract state lack role-based access control beyond a single owner check |
| `ST-023` | Stale Price Oracle | Contract reads from an external price oracle without validating the timestamp of the returned price |

### Low

| Rule ID | Title | Description |
|---------|-------|-------------|
| `ST-030` | Hardcoded Contract Address | Contract logic depends on a hardcoded Stellar address that cannot be updated via governance or an upgrade path |
| `ST-031` | Missing Event Emission | State-changing operations do not emit events, making off-chain monitoring and indexing difficult |
| `ST-032` | Overly Permissive Invoker Auth | Contract uses `invoker_contract_auth` in contexts where stricter authorization is appropriate |

### Info

| Rule ID | Title | Description |
|---------|-------|-------------|
| `ST-040` | No Upgrade Mechanism | Contract has no upgrade path — any critical bug would require deploying a new contract and migrating state |
| `ST-041` | Large Instance Storage | Contract stores a large or unbounded amount of data in instance storage, which is more expensive than persistent |

---

## Rule Structure

Each rule is defined as a `ScanRule` object:

```typescript
interface ScanRule {
  id: string;                   // e.g. 'ST-010'
  title: string;                // Short title
  description: string;          // What the vulnerability is
  severity: Severity;           // critical | high | medium | low | info
  category: RuleCategory;       // storage | auth | arithmetic | design | events
  remediation: string;          // How to fix it
  references?: string[];        // Links to docs, advisories, examples
  tags: string[];               // e.g. ['soroban', 'storage', 'archival']
}
```

---

## Adding a New Rule

1. Create a new file in `src/rules/` named after the rule ID (e.g. `ST-042.ts`)
2. Export a `ScanRule` object following the structure above
3. Register the rule in `src/index.ts`
4. Add test cases in `src/__tests__/` with at least one vulnerable example and one clean example
5. Open a pull request — rule additions are reviewed for accuracy and remediation quality

```typescript
// src/rules/ST-042.ts
import type { ScanRule } from '@sorotrace/types';

export const ST_042: ScanRule = {
  id: 'ST-042',
  title: 'Your Rule Title',
  description: 'Description of the vulnerability and when it occurs.',
  severity: 'medium',
  category: 'storage',
  remediation: 'How to fix the issue, with a brief code example if helpful.',
  references: ['https://docs.stellar.org/relevant-doc'],
  tags: ['soroban', 'storage'],
};
```

---

## Rule Categories

| Category | Description |
|----------|-------------|
| `storage` | Issues with Soroban's three-tier storage model and TTL management |
| `auth` | Authorization and access control vulnerabilities |
| `arithmetic` | Integer overflow, underflow, and precision issues |
| `design` | Architectural issues — upgradeability, hardcoded values, event emission |
| `events` | Missing or incorrect event emission |