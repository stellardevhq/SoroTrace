# Spike Notes — Soroban XDR Decoding

**Package:** `packages/soroban-parser`  
**Spike script:** `spike/decode-spike.ts`  
**SDK version tested:** `@stellar/stellar-sdk` v13.3.0  
**Date:** June 2026  
**Status:** Complete — production design decisions can now be made.

---

## What the Spike Validated

The spike had two goals:

1. Confirm that `@stellar/stellar-sdk` v13 can decode all common Soroban XDR types into typed TypeScript objects without requiring a custom XDR parser.
2. Understand where the SDK falls short and what will need manual handling.

The local decode section of the spike (`runLocalDecodeValidation`) was executed and passed fully. The live RPC fetch was attempted but blocked by egress policy in the sandbox environment. The local validation is sufficient to assess SDK capability because the same decode path (`scValToNative`, `xdr.ScVal.fromXDR`) is used whether data came from the network or is parsed from raw bytes.

---

## SDK Methods Used

| Method / API | Purpose |
| --- | --- |
| `new StellarRpc.Server(url)` | Connect to the Soroban RPC endpoint |
| `server.getTransaction(hash)` | Fetch a complete transaction by hash, including envelope, result, and meta |
| `xdr.ScVal.fromXDR(bytes)` | Parse raw XDR bytes into a typed `ScVal` object |
| `scValToNative(scVal)` | Convert any `ScVal` into a JavaScript native value (string, bigint, boolean, null, object, array, Buffer) |
| `xdr.TransactionMeta.v3()` | Access the v3 transaction meta, which contains Soroban-specific storage diffs and events |
| `resultMetaXdr.v3().sorobanMeta()` | Access the Soroban metadata section: events and diagnostics |
| `resultMetaXdr.v3().operations()` | Access per-operation ledger entry changes (storage before/after) |
| `envelopeXdr.value().tx.operations()` | Walk the envelope to reach the `InvokeHostFunction` operation |
| `invokeContract.functionName()` | Retrieve the called function name as an `ScVal` (type: `scvSymbol`) |
| `invokeContract.args()` | Array of `ScVal` input arguments |
| `contractData.key()` / `.val()` | Raw `ScVal` for storage entry key and value |
| `contractData.durability()` | `persistent` or `temporary` |

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

The call path to reach the function name from a `TransactionEnvelope` is verbose:

```typescript
envelope
  .value()         // TransactionV1Envelope | FeeBumpTransactionEnvelope
  .tx              // TransactionV1
  ?.operations?.() // xdr.Operation[]
  ?.[0]
  ?.body()
  ?.invokeHostFunctionOp?.()
  ?.hostFunction()
  ?.invokeContract()
  ?.functionName() // xdr.ScVal (scvSymbol)
```

Every `?.` is a real nullable access — fee-bump envelopes have a different structure. The production parser needs a dedicated `extractInvokeArgs(envelope)` helper that handles both envelope shapes and throws a typed error if the operation is not an `InvokeHostFunction`.

### 4. TransactionMeta version branching

The `resultMetaXdr` field uses a version-discriminated union:

- **v0 / v1 / v2** — pre-Soroban formats. No `sorobanMeta()` section. Encountered on Stellar Classic transactions.
- **v3** — current Soroban format. Contains `sorobanMeta()` for events and `operations()` for storage diffs.

The production parser must check `resultMetaXdr.switch().value === 3` before accessing any Soroban-specific fields, otherwise the SDK throws.

### 5. BigInt serialisation

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
| `scvLedgerKeyContractInstance` | Special case for contract instance storage — needs separate decoding path |
| Diagnostic events vs. contract events | `sorobanMeta.events()` contains only contract events; diagnostic events are in `sorobanMeta.diagnosticEvents()` and are only present on FAILED transactions |

---

## Network Access in CI

The live RPC fetch in the spike requires outbound HTTPS to `soroban-testnet.stellar.org`. In sandboxed CI environments (GitHub Actions private runners, Claude sandbox, etc.) this may be blocked by egress policy.

**Recommendation:** the spike live-fetch section is informational only and is not part of the automated test suite. Run it manually when investigating a specific transaction. The local decode section (`SPIKE_MODE=local`) runs without network access and covers all SDK decode paths.

For integration tests in the production `src/` parser, use fixture XDR blobs captured from real transactions and committed to `src/__fixtures__/`. This keeps tests deterministic and fast.

---

## Conclusion

`@stellar/stellar-sdk` v13 covers the vast majority of Soroban XDR decoding without custom binary parsing. The main work for the production parser is:

1. Wrapping the verbose access paths in clean, typed helpers.
2. Handling the two edge cases (`scvBytes`, `scvAddress`) consistently.
3. Enforcing the TransactionMeta v3 guard.
4. Deciding the BigInt serialisation strategy at the API boundary.

No third-party XDR library is needed. The SDK's built-in XDR types and `scValToNative` are sufficient.
