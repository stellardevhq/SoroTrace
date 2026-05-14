# packages/stellar-sdk-utils

**Stellar SDK and Horizon API utilities for SoroTrace.**

Wrappers and helpers around the official [Stellar SDK](https://stellar.github.io/js-stellar-sdk/) and the Horizon and Soroban RPC APIs. Both `apps/api` and `apps/web` import from this package — no duplicated Stellar SDK setup or repeated boilerplate.

---

## Usage

```typescript
import {
  getTransaction,
  getContractInvocations,
  getAccountInfo,
  simulateTransaction,
  decodeXdr,
} from '@sorotrace/stellar-sdk-utils';
```

---

## Modules

### `horizon.ts` — Horizon API helpers

```typescript
// Fetch a transaction by hash
getTransaction(hash: string): Promise<HorizonTransaction>

// Fetch all Soroban operations for a contract address
getContractInvocations(
  contractAddress: string,
  options?: { cursor?: string; limit?: number; order?: 'asc' | 'desc' }
): Promise<PaginatedResult<HorizonOperation>>

// Fetch account details
getAccountInfo(address: string): Promise<AccountDetails>

// Fetch account transaction history
getAccountTransactions(
  address: string,
  options?: PaginationOptions
): Promise<PaginatedResult<HorizonTransaction>>

// Fetch ledger details
getLedger(sequence: number): Promise<LedgerDetails>
```

### `rpc.ts` — Soroban RPC helpers

```typescript
// Fetch the current state of a Soroban contract's storage
getContractData(
  contractAddress: string,
  key: xdr.ScVal,
  durability: 'persistent' | 'temporary'
): Promise<ContractDataEntry>

// Get all ledger entries for a contract
getContractStorageEntries(
  contractAddress: string
): Promise<StorageEntry[]>

// Simulate a transaction against the current ledger state
simulateTransaction(
  transaction: Transaction
): Promise<SimulationResult>

// Get contract events from a ledger range
getContractEvents(
  contractAddress: string,
  startLedger: number,
  endLedger?: number
): Promise<ContractEvent[]>

// Get the current ledger sequence
getLatestLedger(): Promise<number>
```

### `xdr.ts` — XDR encoding and decoding

```typescript
// Decode an XDR ScVal into a human-readable DecodedValue
decodeScVal(scVal: xdr.ScVal): DecodedValue

// Decode a base64-encoded XDR string
decodeXdrBase64(encoded: string): DecodedValue

// Encode a JavaScript value into an ScVal for use in transactions
encodeToScVal(value: unknown): xdr.ScVal

// Decode a contract invocation result XDR
decodeInvocationResult(resultXdr: string): DecodedValue

// Decode the meta XDR from a transaction to extract storage changes
decodeTransactionMeta(metaXdr: string): TransactionMeta
```

### `accounts.ts` — Account utilities

```typescript
// Check if an address is a valid Stellar account address
isValidAddress(address: string): boolean

// Check if an address is a contract address (C...)
isContractAddress(address: string): boolean

// Resolve a contract address to its deployer account
getContractDeployer(contractAddress: string): Promise<string | null>

// Format a Stellar address for display (truncated)
formatAddress(address: string, chars?: number): string
// e.g. "GABCD...WXYZ"
```

---

## Configuration

The package reads network configuration from environment variables. Set these in your app's `.env`:

```env
STELLAR_NETWORK="testnet"                           # testnet | mainnet
STELLAR_HORIZON_URL="https://horizon-testnet.stellar.org"
STELLAR_RPC_URL="https://soroban-testnet.stellar.org"
```

Or pass configuration explicitly:

```typescript
import { createStellarClient } from '@sorotrace/stellar-sdk-utils';

const client = createStellarClient({
  network: 'mainnet',
  horizonUrl: 'https://horizon.stellar.org',
  rpcUrl: 'https://mainnet.sorobanrpc.com',
});
```

---

## Error Handling

All functions throw typed errors:

```typescript
import { StellarNotFoundError, StellarRpcError } from '@sorotrace/stellar-sdk-utils';

try {
  const tx = await getTransaction(hash);
} catch (err) {
  if (err instanceof StellarNotFoundError) {
    // Transaction not found on the network
  }
  if (err instanceof StellarRpcError) {
    // RPC call failed — err.code and err.message available
  }
}
```