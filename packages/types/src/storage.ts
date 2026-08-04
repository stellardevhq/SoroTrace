/**
 * Soroban storage tier model — shared types for apps/api and apps/web.
 *
 * Mirrored from `@sorotrace/soroban-parser` so both apps can consume the
 * storage model without importing the parser package. The canonical
 * definitions (and the TTL severity classifier) live in
 * `packages/soroban-parser/src/storage.ts`.
 */

/**
 * One of Soroban's three storage tiers, with their documented characteristics.
 *
 * ─── `instance` ─────────────────────────────────────────────────────────────
 *   Persistence : lives with the contract instance — created at deployment,
 *                 updated on upgrade, exists for the contract's lifetime.
 *   TTL         : not TTL-monitored by SoroTrace (no ttlLedger); the product
 *                 model treats instance state as contract-lifetime state.
 *   Use cases   : contract code/WASM hash, instance-wide configuration, and
 *                 invariants shared by every caller.
 *   Fees        : a single entry per contract; no per-entry TTL extension
 *                 under normal operation.
 *
 * ─── `persistent` ───────────────────────────────────────────────────────────
 *   Persistence : durable — survives across ledgers until archived.
 *   TTL         : every entry has a TTL in ledgers; it archives when the TTL
 *                 reaches zero unless extended with `extend_ttl`. This is the
 *                 tier TTL monitoring targets (ttl_expiry alerts, TTL health
 *                 indicator, TTL warning badges).
 *   Use cases   : the actual contract state — balances, allowances, settings,
 *                 any data that must survive between transactions.
 *   Fees        : storage rent — extending TTL costs a fee; entries near
 *                 archival are more expensive to restore. More costly than
 *                 temporary storage.
 *
 * ─── `temporary` ────────────────────────────────────────────────────────────
 *   Persistence : ephemeral — cleared when the ledger closes; data does not
 *                 survive between ledgers.
 *   TTL         : no long-lived TTL; not applicable to archival monitoring.
 *   Use cases   : transient computation results, buffers, and values that do
 *                 not need to outlive the current transaction.
 *   Fees        : no ongoing TTL rent — the cheapest storage tier.
 */
export const StorageTiers = {
  Instance: "instance",
  Persistent: "persistent",
  Temporary: "temporary",
} as const;

/** Union of the three Soroban storage tiers. */
export type StorageTier = (typeof StorageTiers)[keyof typeof StorageTiers];

/**
 * Base64-encoded raw XDR. Matches the raw XDR `text` columns stored in the
 * database (`keyXdr` / `valueXdr`) and what `toXDR()` produces.
 */
export type RawXdr = string;

/**
 * A Soroban ScVal decoded to a JavaScript value.
 *
 * Mirrors `scValToNative()` from `@stellar/stellar-sdk`:
 * - `scvVoid` → `null`, `scvBool` → `boolean`, numeric ScVals → `number`/`bigint`
 * - `scvSymbol` / `scvString` → `string`, `scvBytes` → `Uint8Array`
 * - `scvVec` → array, `scvMap` → plain object
 *
 * `Uint8Array` (rather than Node's `Buffer`) keeps this package dependency
 * free; a `Buffer` is assignable to `Uint8Array`.
 */
export type DecodedValue =
  | null
  | boolean
  | number
  | bigint
  | string
  | Uint8Array
  | DecodedValue[]
  | { [key: string]: DecodedValue };

/**
 * A single storage entry belonging to one tier.
 *
 * `key` / `value` carry the raw XDR (the source of truth); `keyDecoded` /
 * `valueDecoded` are the decoded values used for display and querying.
 *
 * `ttlLedger` is the ledger at which a persistent entry archives. It is only
 * set for `persistent` entries:
 * - `persistent` — the entry's TTL expiry ledger.
 * - `instance` / `temporary` — omitted (`instance` lives with the contract,
 *   `temporary` is cleared each ledger; neither is TTL-monitored).
 */
export interface StorageEntry {
  /** Which of the three tiers this entry belongs to. */
  tier: StorageTier;
  /** Raw XDR of the storage key (base64). */
  key: RawXdr;
  /** Decoded storage key. */
  keyDecoded: DecodedValue;
  /** Raw XDR of the storage value (base64). */
  value: RawXdr;
  /** Decoded storage value. */
  valueDecoded: DecodedValue;
  /** Ledger at which this persistent entry archives. Persistent only. */
  ttlLedger?: number;
}

/**
 * The complete set of storage entries read or written by a single
 * transaction, grouped by tier. Mirrors the Storage Diff panel layout in the
 * Transaction Debugger (FRD §8.3).
 */
export interface StorageDiff {
  /** Entries in the instance tier touched by the transaction. */
  instance: StorageEntry[];
  /** Entries in the persistent tier touched by the transaction. */
  persistent: StorageEntry[];
  /** Entries in the temporary tier touched by the transaction. */
  temporary: StorageEntry[];
}

/**
 * Severity of a TTL warning for a persistent entry, derived from the number
 * of ledgers remaining until archival.
 *
 * Thresholds follow the FRD §7.4 TTL Health Indicator:
 * - `low`    — more than 50,000 ledgers remaining (green indicator)
 * - `medium` — between 10,000 and 50,000 ledgers remaining (amber)
 * - `high`   — fewer than 10,000 ledgers remaining (red)
 */
export type TtlSeverity = "low" | "medium" | "high";

/**
 * A persistent storage entry falls below `TTL_SEVERITY_HIGH_LEDGERS` ledgers
 * remaining → `high` severity (FRD §7.4 red / §8.3 amber warning badge).
 */
export const TTL_SEVERITY_HIGH_LEDGERS = 10_000;

/**
 * A persistent storage entry has at most `TTL_SEVERITY_LOW_LEDGERS` ledgers
 * remaining → `medium` severity. Above this the entry is `low`.
 */
export const TTL_SEVERITY_LOW_LEDGERS = 50_000;

/**
 * A TTL warning for a persistent storage entry.
 *
 * - `currentTtl` — the entry's current TTL in ledgers.
 * - `ledgersUntilArchival` — ledgers remaining before the entry archives.
 * - `severity` — `low` | `medium` | `high` per the FRD §7.4 thresholds.
 *
 * Only persistent entries carry TTL warnings; instance and temporary entries
 * never produce one.
 */
export interface TtlWarning {
  /** Current TTL of the entry, in ledgers. */
  currentTtl: number;
  /** Ledgers remaining until the entry is archived. */
  ledgersUntilArchival: number;
  /** Severity classification per the FRD §7.4 thresholds. */
  severity: TtlSeverity;
}
