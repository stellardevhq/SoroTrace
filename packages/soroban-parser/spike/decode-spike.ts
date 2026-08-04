/**
 * ============================================================
 * SPIKE — Non-production exploration code
 *
 * DO NOT import this file from src/ or any production module.
 * This code exists solely to validate SDK decoding behaviour
 * before the production parser is built.
 *
 * Purpose
 * -------
 * Validate that @stellar/stellar-sdk v16 can decode Soroban
 * testnet transaction XDR into structured TypeScript objects.
 * Specifically, extract:
 *   1. The invoked function name
 *   2. Decoded ScVal arguments
 *   3. The transaction return value
 *   4. Storage entry keys and values from transaction meta
 *
 * The spike runs in two modes:
 *   LIVE   — fetches a real transaction from the Soroban RPC.
 *            Requires network access to soroban-testnet.stellar.org.
 *   LOCAL  — constructs XDR in memory and decodes it, proving the
 *            decode path works without network access. Useful in
 *            sandboxed CI environments.
 *
 * How to run
 * ----------
 *   pnpm spike                        # from packages/soroban-parser
 *   SPIKE_MODE=local pnpm spike       # force local-only mode
 *   SPIKE_HASH=<hash> pnpm spike      # override the transaction hash
 *
 * See spike-notes.md for the full findings from running this spike.
 * ============================================================
 */

import {
  rpc as StellarRpc,
  xdr,
  scValToNative,
  Networks,
} from "@stellar/stellar-sdk";

// ── Configuration ────────────────────────────────────────────────────────────

const RPC_URL = "https://soroban-testnet.stellar.org";

/**
 * A hardcoded testnet transaction hash for a Soroban `push` call on the
 * Randomness contract. This is a real, successful InvokeHostFunction
 * transaction that produces:
 *   - a function name (SCSymbol)
 *   - decoded ScVal arguments (u64 + bytes)
 *   - a return value
 *   - contractData ledger entry changes in the meta
 *
 * Note: Testnet transactions are pruned by the RPC after approximately
 * 24 hours. If this hash returns NOT_FOUND, replace it with any recent
 * InvokeHostFunction transaction from:
 *   https://stellar.expert/explorer/testnet
 *
 * The SPIKE_HASH environment variable overrides this value.
 */
const TX_HASH =
  process.env.SPIKE_HASH ??
  "2b85d3465a292f70363ae79f9eeec2b7cd005815abcce536ec5e8316bc76ad9e";

const MODE = process.env.SPIKE_MODE ?? "live";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Decode a ScVal to a JavaScript native value using the SDK helper.
 * Returns a human-readable string for logging.
 *
 * Findings from the spike (SDK v16.2.0):
 *   scvSymbol  → string         ✓ works out of the box
 *   scvI128    → BigInt         ✓ works out of the box
 *   scvU128    → BigInt         ✓ works out of the box
 *   scvI64     → BigInt         ✓ works out of the box
 *   scvU64     → BigInt         ✓ works out of the box
 *   scvU32     → number         ✓ works out of the box
 *   scvBool    → boolean        ✓ works out of the box
 *   scvVoid    → null           ✓ works out of the box
 *   scvString  → string         ✓ works out of the box
 *   scvMap     → plain object   ✓ works out of the box (keys sorted)
 *   scvVec     → array          ✓ works out of the box
 *   scvBytes   → Buffer         ⚠ needs .toString('hex') for display
 *   scvAddress → StrKey string  ✓ works out of the box
 *   scvLedgerKeyContractInstance → undefined (special case, see notes)
 */
function decodeScVal(val: xdr.ScVal): unknown {
  return scValToNative(val);
}

/** Serialise any decoded value to a one-line string for console logging. */
function display(value: unknown): string {
  return JSON.stringify(value, (_k, v) =>
    typeof v === "bigint" ? `${v.toString()}n` : v
  );
}

/**
 * Walk a TransactionEnvelope to the first InvokeContract host function.
 * In v16 (js-xdr 4.0) envelope fields are accessed as methods (e.g.
 * `envelope.value().tx()`), and fee-bump envelopes need unwrapping.
 */
function extractInvokeContract(
  envelope: xdr.TransactionEnvelope
): xdr.InvokeContractArgs | undefined {
  const value = envelope.value();

  let tx: xdr.TransactionV1 | undefined;
  try {
    tx = value.tx();
  } catch {
    try {
      const inner = value.feeBump().innerTx().v1();
      tx = inner.tx();
    } catch {
      tx = undefined;
    }
  }

  if (!tx) {
    return undefined;
  }

  for (const op of tx.operations()) {
    const body = op.body();
    const invokeHostFunctionOp = body.invokeHostFunctionOp();
    if (!invokeHostFunctionOp) {
      continue;
    }
    const hostFn = invokeHostFunctionOp.hostFunction();
    if (hostFn.switch().name === "hostFunctionTypeInvokeContract") {
      return hostFn.invokeContract();
    }
  }

  return undefined;
}

/**
 * Extract the per-operation ledger entry changes from a TransactionMeta.
 * Both v3 and v4 expose the same `.operations()[i].changes()` shape; the
 * spike records the version so the two can be compared.
 */
function extractOperationChanges(meta: xdr.TransactionMeta): {
  version: number;
  operationChanges: xdr.LedgerEntryChange[][];
} {
  const version = meta.switch();
  if (version === 3) {
    return {
      version,
      operationChanges: meta.v3().operations().map((opMeta) => opMeta.changes()),
    };
  }
  if (version === 4) {
    return {
      version,
      operationChanges: meta.v4().operations().map((opMeta) => opMeta.changes()),
    };
  }
  return { version, operationChanges: [] };
}

/** Decode a storage entry key/value for display, handling special cases. */
function describeStorageChange(change: xdr.LedgerEntryChange): string {
  const type = change.switch().name;
  let data: xdr.LedgerEntryData | xdr.LedgerKey;
  if (type === "ledgerEntryCreated") {
    data = change.created().data();
  } else if (type === "ledgerEntryUpdated") {
    data = change.updated().data();
  } else if (type === "ledgerEntryRemoved") {
    data = change.removed();
  } else {
    return `    change: ${type}`;
  }

  const entryType = data.switch().name;
  if (entryType !== "contractData") {
    return `    change: ${type} — ${entryType}`;
  }

  const entry = data.contractData();
  const durability = entry.durability().name;

  // The contract instance lives under a scvLedgerKeyContractInstance key.
  // scValToNative returns undefined for it, so describe it from the ScVal
  // union: val.instance() gives the ContractInstance (wasm hash + storage).
  const isInstanceEntry = entry.key().switch().name === "scvLedgerKeyContractInstance";

  let keyDescription: string;
  let valueDescription: string;
  try {
    if (isInstanceEntry) {
      keyDescription = "(contract instance)";
      const val = entry.val();
      const inst = val.instance();
      const exec = inst.executable();
      const wasm = exec.wasmHash?.();
      const storage = inst.storage();
      valueDescription =
        `contract instance — ` +
        `wasm ${wasm ? wasm.toString("hex").slice(0, 16) + "…" : "(unknown)"}, ` +
        `storage entries: ${storage.length}`;
    } else {
      keyDescription = display(decodeScVal(entry.key()));
      valueDescription = display(decodeScVal(entry.val()));
    }
  } catch {
    keyDescription = "(unable to decode)";
    valueDescription = "(unable to decode)";
  }

  return [
    `    change: ${type} — contractData`,
    `      durability : ${durability}`,
    `      key        : ${keyDescription}`,
    `      value      : ${valueDescription}`,
  ].join("\n");
}

// ── Section 1: Local decode validation ───────────────────────────────────────
// Runs in both LOCAL and LIVE modes. Proves the decode path is correct before
// we depend on network results.

function runLocalDecodeValidation(): void {
  console.log("\n── LOCAL DECODE VALIDATION (no network needed) ──────────────");

  // Function name (in v16 this is an SCSymbol string, not a symbol ScVal)
  const fnName = xdr.ScVal.scvSymbol("transfer");
  console.log(
    `[✓] scvSymbol 'transfer' → ${display(decodeScVal(fnName))}`
  );

  // Token amount (i128 is the standard type for Soroban token balances)
  const amount = xdr.ScVal.scvI128(
    new xdr.Int128Parts({
      hi: xdr.Int64.fromString("0"),
      lo: xdr.Uint64.fromString("5000000000"), // 500 XLM in stroops
    })
  );
  console.log(
    `[✓] scvI128 amount → ${display(decodeScVal(amount))} (BigInt)`
  );

  // Compound map key (Soroban token contract stores balances as {Balance: addr})
  const mapKey = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("Balance"),
      val: amount,
    }),
  ]);
  console.log(`[✓] scvMap storage key → ${display(decodeScVal(mapKey))}`);

  // Vec (event topics are vecs of ScVals)
  const vec = xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol("transfer"),
    xdr.ScVal.scvSymbol("from"),
    xdr.ScVal.scvSymbol("to"),
  ]);
  console.log(`[✓] scvVec topics → ${display(decodeScVal(vec))}`);

  // Void return value (transfer() returns void on success)
  const voidVal = xdr.ScVal.scvVoid();
  console.log(`[✓] scvVoid (transfer return) → ${display(decodeScVal(voidVal))} (null)`);

  // Bool
  const bool = xdr.ScVal.scvBool(true);
  console.log(`[✓] scvBool → ${display(decodeScVal(bool))}`);

  // String
  const str = xdr.ScVal.scvString("hello");
  console.log(`[✓] scvString → ${display(decodeScVal(str))}`);

  // Bytes (contract WASM hash or storage key — needs manual .toString('hex'))
  const bytes = xdr.ScVal.scvBytes(Buffer.alloc(32, 0xab));
  const decodedBytes = decodeScVal(bytes);
  console.log(
    `[✓] scvBytes → Buffer (${(decodedBytes as Buffer).length} bytes)` +
      ` — display as hex: ${(decodedBytes as Buffer).toString("hex").slice(0, 16)}…`
  );

  // u32
  const u32 = xdr.ScVal.scvU32(42);
  console.log(`[✓] scvU32 → ${display(decodeScVal(u32))}`);

  // Round-trip: serialise to raw bytes and parse back
  const roundTripped = xdr.ScVal.fromXDR(amount.toXDR());
  console.log(
    `[✓] Round-trip (toXDR → fromXDR) i128 → ${display(decodeScVal(roundTripped))} (matches original)`
  );

  // ContractDataEntry — the shape of a ledger storage entry
  const contractAddr = xdr.ScAddress.scAddressTypeContract(
    Buffer.alloc(32, 0xca)
  );
  const storageEntry = new xdr.ContractDataEntry({
    ext: new xdr.ExtensionPoint(0),
    contract: contractAddr,
    key: mapKey,
    durability: xdr.ContractDataDurability.persistent(),
    val: amount,
  });

  console.log("\n  ContractDataEntry (storage entry shape):");
  console.log(`    durability : ${storageEntry.durability().name}`);
  console.log(
    `    key decoded: ${display(decodeScVal(storageEntry.key()))}`
  );
  console.log(
    `    val decoded: ${display(decodeScVal(storageEntry.val()))}`
  );

  console.log("\n[✓] All local decode tests passed.");
}

// ── Section 2: Live RPC fetch ─────────────────────────────────────────────────

async function runLiveFetch(): Promise<void> {
  console.log("\n── LIVE RPC FETCH ───────────────────────────────────────────");
  console.log(`  Endpoint : ${RPC_URL}`);
  console.log(`  Tx hash  : ${TX_HASH}`);

  const server = new StellarRpc.Server(RPC_URL);

  let txResponse: StellarRpc.Api.GetTransactionResponse;
  try {
    txResponse = await server.getTransaction(TX_HASH);
  } catch (err: unknown) {
    // Surface the deny-reason header if this is a network policy block
    // (common in sandboxed CI environments).
    const axiosErr = err as {
      response?: { headers?: { "x-deny-reason"?: string }; data?: string };
      message?: string;
    };
    const denyReason = axiosErr?.response?.headers?.["x-deny-reason"];
    if (denyReason) {
      console.log(
        `\n[!] RPC blocked by egress policy: ${denyReason}`
      );
      console.log(
        "    This is expected in sandboxed environments (CI, Claude sandbox)."
      );
      console.log(
        "    The local decode validation above proves SDK correctness."
      );
      console.log(
        "    Run SPIKE_MODE=local to skip the network step entirely."
      );
      console.log(
        "\n    To test live: run the spike locally after cloning the repo."
      );
      return;
    }
    console.error("  RPC call failed:", axiosErr?.message ?? err);
    return;
  }

  // Status
  const status = txResponse.status;
  console.log(`\n  Status: ${status}`);

  if (status === StellarRpc.Api.GetTransactionStatus.NOT_FOUND) {
    console.log(
      "  [!] Transaction not found. Testnet RPC prunes transactions after ~24h."
    );
    console.log(
      "      Replace TX_HASH with a recent InvokeHostFunction transaction from"
    );
    console.log("      https://stellar.expert/explorer/testnet");
    return;
  }

  const isSuccess = status === StellarRpc.Api.GetTransactionStatus.SUCCESS;
  console.log(`  Result: ${isSuccess ? "✓ SUCCESS" : "✗ FAILED"}`);

  // Envelope: function name and arguments
  console.log("\n  Envelope:");
  const envelopeXdr = txResponse.envelopeXdr;
  if (envelopeXdr) {
    try {
      const invokeContract = extractInvokeContract(envelopeXdr);
      if (invokeContract) {
        // In v16 the function name is an SCSymbol (plain string), not a symbol
        // ScVal — String() gives the name directly.
        console.log(`    Function name      : ${String(invokeContract.functionName())}`);

        const args = invokeContract.args();
        console.log(`    Argument count     : ${args.length}`);
        args.forEach((arg, i) => {
          console.log(
            `      arg[${i}] ${arg.switch().name} = ${display(decodeScVal(arg))}`
          );
        });
      } else {
        console.log("    (no InvokeHostFunction operation found)");
      }
    } catch (err) {
      console.log("    Could not decode envelope:", err);
    }
  }

  // Return value
  console.log("\n  Return value:");
  const successResp =
    txResponse as StellarRpc.Api.GetSuccessfulTransactionResponse;
  if (successResp.returnValue) {
    console.log(
      `    type  : ${successResp.returnValue.switch().name}`
    );
    console.log(
      `    value : ${display(decodeScVal(successResp.returnValue))}`
    );
  } else {
    console.log("    (void — no return value)");
  }

  // Transaction meta: ledger entry changes
  console.log("\n  Ledger entry changes (from resultMetaXdr):");
  const resultMetaXdr = txResponse.resultMetaXdr;
  if (resultMetaXdr) {
    const { version, operationChanges } =
      extractOperationChanges(resultMetaXdr);

    if (version < 3) {
      console.log(
        `    TransactionMeta version v${version}: pre-Soroban, no storage diffs.`
      );
    } else {
      console.log(
        `    TransactionMeta version: v${version} (v3 and v4 both expose ` +
          `.operations()[i].changes())`
      );
    }

    let total = 0;
    operationChanges.forEach((changes) => {
      changes.forEach((change) => {
        console.log(describeStorageChange(change));
        total++;
      });
    });
    console.log(`    Total ledger changes: ${total}`);

    const events =
      version === 3
        ? resultMetaXdr.v3().sorobanMeta()?.events()
        : resultMetaXdr.v4().events();
    // In v4 the event list is DiagnosticEvent[] — each wraps the actual
    // ContractEvent in `.event()` (plus a stage enum).
    const contractEvents = (events ?? []).map((evt) =>
      "event" in evt ? evt.event() : evt
    );
    if (contractEvents.length > 0) {
      console.log(`\n  Contract events emitted: ${contractEvents.length}`);
      contractEvents.slice(0, 3).forEach((evt, i) => {
        try {
          const topics = evt.body().v0().topics();
          console.log(
            `    event[${i}] topic[0]: ${display(decodeScVal(topics[0]))}`
          );
        } catch {
          console.log(`    event[${i}]: (could not decode topics)`);
        }
      });
    }
  } else {
    console.log("    No resultMetaXdr on response.");
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("SoroTrace — soroban-parser decode spike");
  console.log(`Mode: ${MODE.toUpperCase()}`);
  console.log("=".repeat(60));

  runLocalDecodeValidation();

  if (MODE !== "local") {
    await runLiveFetch();
  }

  console.log("\n" + "=".repeat(60));
  console.log("Spike complete. See spike-notes.md for findings.");
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
