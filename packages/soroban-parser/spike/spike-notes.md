## Spike Notes: Soroban XDR Decoding

**Package:** `packages/soroban-parser`  
**Spike script:** `spike/decode-spike.ts`  
**SDK version tested:** `@stellar/stellar-sdk` v16.2.0  
**Date:** August 2026  
**Status:** Complete: production design decisions can now be made.

---

### What the Spike Validated

The spike had two goals:

1. Confirm that `@stellar/stellar-sdk` v16 can decode all common Soroban XDR types into typed TypeScript objects without requiring a custom XDR parser.
2. Understand where the SDK falls short and what will need manual handling.

Both spike sections were executed and passed:

- **Local decode** (`runLocalDecodeValidation`): all decode paths pass without network access.
- **Live RPC fetch**: fetched a real testnet transaction by hash
  `2b85d3465a292f70363ae79f9eeec2b7cd005815abcce536ec5e8316bc76ad9e`
  (an `InvokeHostFunction` `push` call on the Randomness contract, status SUCCESS)
  and extracted the function name, decoded arguments, return value, storage diffs,
  and contract events from the raw meta XDR.

---

### SDK Methods Used

| Method / API | Purpose |
| --- | --- |
| `new StellarRpc.Server(url)` | Connect to the Soroban RPC endpoint |
| `server.getTransaction(hash)` | Fetch a complete transaction by hash, including envelope, result, and meta |
| `xdr.ScVal.fromXDR(bytes)` | Parse raw XDR bytes into a typed `ScVal` object |
| `scValToNative(scVal)` | Convert any `ScVal` into a JavaScript native value (string, bigint, boolean, null, object, array, Buffer) |
| `resultMetaXdr.switch()` | Discriminated-union version of the transaction meta |
| `resultMetaXdr.v4()` / `.v3()` | Access the v4/v3 transaction meta, which contains per-operation storage diffs and events |
| `meta.v3().sorobanMeta()` | v3 Soroban metadata section: contract events and diagnostics |
| `meta.v4().operations()` | Per-operation ledger entry changes (storage before/after) |
| `meta.v4().events()` | Contract events — **wrapped as `DiagnosticEvent[]`**; unwrap with `evt.event()` |
| `envelopeXdr.value().tx()` | Walk the envelope to reach the `TransactionV1` (method call in v16) |
| `tx.operations()[i].body().invokeHostFunctionOp()` | Reach the `InvokeHostFunction` operation |
| `invokeContract.functionName()` | Called function name — in v16 this is an **SCSymbol string** (`String()` it), not an ScVal |
| `invokeContract.args()` | Array of `ScVal` input arguments |
| `contractData.key()` / `.val()` | Raw `ScVal` for storage entry key and value |
| `contractData.durability()` | `persistent` or `temporary` |

> **v16 accessor note:** the v13 spike code used property access (`.tx`, `.operations()`, `.value()`). In v16
> (built on js-xdr 4.0) envelope fields are **methods**: `envelope.value().tx()`,
> `tx.operations()[i].body().invokeHostFunctionOp()`. Function names also changed shape:
> `hostFunctionTypeInvokeContract` (invokeContract switch name).

---

## What Decoded Correctly Without Custom Handling

All of the following decoded cleanly via `scValToNative`:

| ScVal type | JS result | Notes |
| --- | --- | --- |
| `scvSymbol` | `string` | Function names, event discriminants, map keys |
| `scvI128` | `BigInt` | Token balances — SDK returns a native BigInt |
| `scvU128` | `BigInt` | Same path as i128 |
| `scvI64` | `BigInt` | Same path |
| `scvU64` | `BigInt` | Same path |
| `scvU32` | `number` | Small integers: indices, enumerations |
| `scvBool` | `boolean` | Auth flags, condition results |
| `scvVoid` | `null` | Return value of functions like `transfer()` |
| `scvString` | `string` | Human-readable metadata fields |
| `scvMap` | plain `object` | Compound storage keys; keys are sorted by the SDK |
| `scvVec` | `Array` | Event topics, argument lists |

Composite types (`scvMap`, `scvVec`) recurse correctly - nested i128 values inside a map decode to BigInt without extra steps.

Round-trip serialisation also works: `xdr.ScVal.fromXDR(val.toXDR())` reproduces the original value exactly. This means the parser can accept raw XDR bytes directly (e.g., from a database or queue) without needing the full SDK envelope wrapper.

---

## What Required Manual Handling or Extra Steps

### 1. `scvBytes` → `Buffer`, not a readable string

`scValToNative` returns a Node.js `Buffer` for `scvBytes`. This is correct but requires a display step:

```typescript
// Needed for display and storage
const hex = (decoded as Buffer).toString("hex");
```

Soroban uses `scvBytes` for WASM hashes, raw contract addresses in some contexts, and opaque storage keys. The production parser will need a `bytesToHex` utility.

### 2. `scvAddress` — StrKey encoding requires care

`scvalToNative` for an `scvAddress` returns a StrKey-encoded string (e.g., `GXXXXXXXXX…` for an account or `CXXXXXXXXX…` for a contract). This works, but the raw `xdr.ScAddress` offers more structured access:

```typescript
const addr = scVal.address();
if (addr.switch().name === "scAddressTypeAccount") {
  const accountId = addr.accountId(); // → xdr.AccountId
}
if (addr.switch().name === "scAddressTypeContract") {
  const contractId = addr.contractId(); // → Buffer (32 bytes)
}
```

The production parser should expose both forms: the StrKey string for display and the raw buffer for lookups.

### 3. Function name access path (envelope walking)

The call path to reach the function name from a `TransactionEnvelope` is verbose, and
in v16 every step is a method call:

```typescript
envelope
  .value()              // TransactionV1Envelope | FeeBumpTransactionEnvelope
  .tx()                 // TransactionV1 (method, not property, in v16)
  .operations()[0]      // xdr.Operation[]
  .body()
  .invokeHostFunctionOp()
  .hostFunction()
  .invokeContract()     // only for switch hostFunctionTypeInvokeContract
  .functionName()       // SCSymbol string — String() it directly
```

Every step is a real nullable access — fee-bump envelopes have a different structure
(`value().feeBump().innerTx().v1().tx()`). The production parser needs a dedicated
`extractInvokeArgs(envelope)` helper that handles both envelope shapes and throws a
typed error if the operation is not an `InvokeHostFunction`.

### 4. TransactionMeta version branching

The `resultMetaXdr` field uses a version-discriminated union:

- **v0 / v1 / v2** — pre-Soroban formats. No `sorobanMeta()` section. Encountered on Stellar Classic transactions.
- **v3** — Soroban format with `sorobanMeta()` (contract events + diagnostics) and `operations()` for storage diffs.
- **v4** — the current format produced by testnet in this spike. No `sorobanMeta()`;
  `operations()[i].changes()` and `events()` sit directly on `v4()`. v4 events are
  `DiagnosticEvent[]` (each with a `stage` enum) that wrap the real `ContractEvent` in `.event()`.

The production parser must check `resultMetaXdr.switch()` before accessing any
Soroban-specific fields, otherwise the SDK throws. Note `meta.switch()` returns a raw
number in v16 (e.g. `4`), not an enum object.

### 5. Ledger entry change types (v4 adds `ledgerEntryState`)

Real v4 meta from the spike showed four change types in one transaction:
`ledgerEntryState` (a new v4 change type), `ledgerEntryUpdated` (contract instance),
`ledgerEntryCreated` (TTL entry), and `ledgerEntryCreated` (contract data). The parser
must switch over all of them. The contract instance entry has key switch
`scvLedgerKeyContractInstance` and its value is a ScVal; `val.instance()` yields the
`ContractInstance` (WASM hash via `executable().wasmHash()`, plus `storage()` entries).

### 6. BigInt serialisation

All `i128`, `u128`, `i64`, `u64` ScVals decode to `BigInt`. This means they cannot be JSON-serialised with the default `JSON.stringify`. Any API response or log line that includes these values needs a replacer:

```typescript
JSON.stringify(value, (_k, v) => typeof v === "bigint" ? v.toString() : v)
```

The production parser should decide at the boundary (before returning to the API layer) whether to keep BigInt or convert to string.

---

## Gaps That Need Custom Logic in Later Issues

| Gap | Recommended approach |
| --- | --- |
| `scvAddress` display vs. lookup duality | Utility type `ParsedAddress { strKey: string; bytes: Buffer; type: 'account' \| 'contract' }` |
| `scvBytes` display | Shared `hex(buf: Buffer): string` utility exported from `packages/types` |
| Fee-bump envelope handling | `extractInvokeArgs` should handle `feeBumpTransactionEnvelope` by unwrapping the inner transaction |
| Pre-v3 meta guard | `assertV3Meta` helper that throws a typed `UnsupportedMetaVersionError` |
| BigInt → string at API boundary | `serializeScVal(val: unknown): SerializedScVal` normalising all BigInts to decimal strings before they leave the parser package |
| `scvLedgerKeyContractInstance` | Contract instance storage is stored under this key; `scValToNative` returns `undefined` for it. `val.instance()` gives the `ContractInstance` — decode `executable().wasmHash()` and `storage()` explicitly |
| Diagnostic events vs. contract events | In v3, `sorobanMeta.events()` holds contract events and `sorobanMeta.diagnosticEvents()` the diagnostics (only present on FAILED txs). In v4, `events()` returns `DiagnosticEvent[]` that wrap the contract event in `.event()` — always unwrap before reading `body()` |

---

## Network Access in CI

The live RPC fetch in the spike requires outbound HTTPS to `soroban-testnet.stellar.org`.
In sandboxed CI environments (GitHub Actions private runners, Claude sandbox, etc.) this
may be blocked by egress policy.

**Observation from this run:** the live fetch works in a normal local environment. The
spike ran successfully against a real testnet transaction. The two real-world caveats are:

1. **Testnet RPC prunes transactions after ~24h.** The original hardcoded hash returned
   `NOT_FOUND`; it was replaced with a recent `InvokeHostFunction` transaction. Expect to
   refresh `TX_HASH` (or set `SPIKE_HASH`) over time.
2. If a sandbox denies egress, the RPC responds with an `x-deny-reason` header, which the
   spike detects and reports.

**Recommendation:** the spike live-fetch section is informational only and is not part of
the automated test suite. Run it manually when investigating a specific transaction. The
local decode section (`SPIKE_MODE=local`) runs without network access and covers all SDK
decode paths.

For integration tests in the production `src/` parser, use fixture XDR blobs captured from
real transactions and committed to `src/__fixtures__/`. This keeps tests deterministic and fast.

---

## Conclusion

`@stellar/stellar-sdk` v16 covers the vast majority of Soroban XDR decoding without custom
binary parsing, and its decode paths were verified against a real testnet transaction (v4
meta, storage diffs, events, return value). The main work for the production parser is:

1. Wrapping the verbose (and version-specific) access paths in clean, typed helpers.
2. Handling the two edge cases (`scvBytes`, `scvAddress`) consistently.
3. Enforcing the TransactionMeta version guard (v3 vs v4 branching, `ledgerEntryState`).
4. Deciding the BigInt serialisation strategy at the API boundary.

No third-party XDR library is needed. The SDK's built-in XDR types and `scValToNative` are sufficient.
