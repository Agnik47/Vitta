# Implementation Plan: Database Migration

## Overview

Migrate Mandate Gate's persistence layer from flat files to Postgres using raw SQL via `pg`
(node-postgres). The migration is a data-layer swap only — `decide()`, all TypeScript domain
interfaces, and all caller signatures remain completely unchanged. Two independent `pg.Pool`
instances are created: CLI pool (max 5) and dashboard pool (max 10).

---

## Tasks

- [ ] 1. Schema DDL, migration runner, and `pg` dependency
  - [ ] 1.1 Install `pg` and `@types/pg` in the root package and `fast-check` as a dev dependency
    - Run `npm install pg` and `npm install --save-dev @types/pg fast-check` at repo root
    - Run `cd dashboard && npm install pg` and `npm install --save-dev @types/pg fast-check` in dashboard
    - _Requirements: 2.4, 9.1, 9.2_

  - [ ] 1.2 Write `db/migrations/001_initial_schema.sql`
    - Create all eight tables exactly as specified: `gate_events`, `mandates`, `receipts`,
      `transaction_authorizations`, `purchase_jobs`, `purchase_job_events`, `ledger_entries`,
      `cleared_merchants`
    - Include every column, check constraint, foreign key, and `UNIQUE (job_id, seq)` constraint
    - Include all fourteen indexes using `CREATE INDEX IF NOT EXISTS`
    - Use `CREATE TABLE IF NOT EXISTS` throughout for idempotency
    - _Requirements: 1.1–1.14, 2.1–2.3_

  - [ ] 1.3 Write `db/migrate.ts` runner
    - Read `DATABASE_URL` from `process.env`; throw descriptive error if absent before any
      connection attempt
    - Connect using `pg.Client`, read all `.sql` files from `db/migrations/` in lexicographic
      order, execute each in sequence, then `client.end()`
    - _Requirements: 2.4, 2.5_


- [ ] 2. `Store` interface and `PostgresStore` (`src/db/`)
  - [ ] 2.1 Create `src/db/store.interface.ts`
    - Define the `Store` interface with all ten async method signatures exactly as specified in
      design § Component 1 and Requirement 3.1
    - Import types from `../events/GateEvent`, `../mandate/schema`, `../receipt/schema`,
      `../receipt/authorization` — no new types introduced
    - _Requirements: 3.1, 8.2_

  - [ ] 2.2 Create `src/db/pool.ts`
    - Export a lazily-initialised singleton `Pool` (max 5, `connectionTimeoutMillis: 30000`,
      `options: '-c statement_timeout=30000'`)
    - Read `DATABASE_URL` at first use; throw `"DATABASE_URL is not set…"` if absent
    - Register `process.once('SIGINT'|'SIGTERM'|'exit')` handlers calling `pool.end()`
    - _Requirements: 9.1, 9.3, 9.4, 9.8, 3.11_

  - [ ] 2.3 Create `src/db/postgres-store.ts` — `appendEvent` and `saveMandate`/`loadMandate`
    - Implement `appendEvent`: parameterized `INSERT INTO gate_events` mapping all twelve fields;
      serialize `ts` with `.toISOString()`
    - Implement `saveMandate`: `INSERT … ON CONFLICT (mandate_id) DO UPDATE SET …` upsert
    - Implement `loadMandate`: point-lookup by PK; throw `No mandate found with id "${id}"` on
      zero rows; call `parseFloat()` on any NUMERIC column read-back
    - Implement `loadAllMandates`: `ORDER BY mandate_id DESC`
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.9, 8.3, 8.4_

  - [ ] 2.4 Create `src/db/postgres-store.ts` — `saveReceipt`/`loadReceipt` and
    `saveAuthorization`/`loadAuthorization`
    - Implement `saveReceipt`: parameterized `INSERT INTO receipts`; store `cart`, `payment`,
      `execution`, `evidence` as JSONB; scalar columns as typed values
    - Implement `loadReceipt`: PK lookup; throw `No receipt found with id "${id}"` on zero rows;
      reconstruct `Receipt` by spreading scalar columns and parsed JSONB fields
    - Implement `loadAllReceipts`: `ORDER BY signed_at ASC`
    - Implement `saveAuthorization`: parameterized `INSERT INTO transaction_authorizations`
    - Implement `loadAuthorization`: PK lookup; throw `No authorization found with id "${id}"` on
      zero rows; `parseFloat()` on `reserve_verified_inr`
    - Implement `loadAllAuthorizations`: `ORDER BY authorized_at ASC`
    - _Requirements: 3.2, 3.6, 3.7, 3.8, 3.9, 8.3, 8.5, 8.6_


- [ ] 3. `src/cli/store.ts` re-export wrapper
  - [ ] 3.1 Replace `src/cli/store.ts` with a thin re-export over `PostgresStore`
    - Import `PostgresStore` from `../db/postgres-store`
    - Create and export a singleton `store` instance
    - Re-export every function name currently in `store.ts` (`appendEvent`, `saveMandate`,
      `loadMandate`, `loadAllMandates`, `saveReceipt`, `loadReceipt`, `loadAllReceipts`,
      `saveAuthorization`, `loadAuthorization`, `loadAllAuthorizations`) as thin arrow-function
      delegates to `store.*` — zero changes to callers in `src/cli/gate.ts`
    - _Requirements: 3.10, 8.7_

- [ ] 4. `PravaCreditLedger` ledger audit integration
  - [ ] 4.1 Create `src/db/ledger-store.ts`
    - Export `insertLedgerEntry(entry: { reserveRef, entryType, amountInrPaise, idempotencyKey,
      mandateId?, runId? }): Promise<void>` using `INSERT INTO ledger_entries … ON CONFLICT
      (idempotency_key) DO NOTHING`; on query error: `console.error` and return (never rethrow)
    - Export `getLedgerEntriesByReserve(reserveRef: string): Promise<LedgerEntry[]>` ordered
      by `recorded_at ASC`; call `parseInt()` on `amount_inr_paise` BIGINT column
    - Export `getTotalDrawnForReserve(reserveRef: string): Promise<number>` summing `debit`
      entries via `SUM(amount_inr_paise)` with `parseInt()` coercion on result
    - Define and export the `LedgerEntry` TypeScript interface
    - _Requirements: 6.1–6.6_

  - [ ] 4.2 Wire ledger audit into `src/ledger/PravaCreditLedger.ts`
    - In `draw()`: after `createLedgerEntry` resolves, call `insertLedgerEntry` with
      `entry_type='debit'` and `idempotency_key=runId` — failure must not rethrow
    - In `credit()`: after `createLedgerEntry` resolves, call `insertLedgerEntry` with
      `entry_type='credit'` — failure must not rethrow
    - _Requirements: 6.1, 6.2, 6.3, 6.4_


- [ ] 5. Dashboard `ReadLayer` (`dashboard/lib/db.ts`)
  - [ ] 5.1 Create `dashboard/lib/db-pool.ts`
    - Export a lazily-initialised singleton dashboard `Pool` (max 10,
      `connectionTimeoutMillis: 30000`, `options: '-c statement_timeout=30000'`)
    - Read `DATABASE_URL` at first use; throw descriptive error if absent
    - Register `process.once('SIGINT'|'SIGTERM'|'exit')` handlers calling `pool.end()`
    - _Requirements: 4.7, 4.8, 9.2, 9.3, 9.5_

  - [ ] 5.2 Create `dashboard/lib/db.ts` — `ReadLayer` class
    - Implement `readEventsSince(sinceId: string | null): Promise<GateEvent[]>`:
      if `sinceId` is null → `SELECT * FROM gate_events ORDER BY ts ASC`; otherwise look up
      `sinceId` by PK, if found return rows `WHERE ts > sinceTs ORDER BY ts ASC`, if not found
      fall back to full table scan; coerce `ts` TIMESTAMPTZ back to `.toISOString()` string
    - Implement `readCurrentMandate(): Promise<Mandate | null>`:
      `SELECT * FROM mandates ORDER BY mandate_id DESC LIMIT 1`; return null on zero rows;
      deserialize `scope` and `reserve` JSONB columns into typed sub-objects
    - Implement `readReceipts(): Promise<Receipt[]>`: `ORDER BY signed_at ASC`; reconstruct
      `Receipt` by spreading scalar columns and JSONB columns (`cart`, `payment`, `execution`,
      `evidence`)
    - Implement `readAuthorizations(): Promise<TransactionAuthorization[]>`:
      `ORDER BY authorized_at ASC`; reconstruct from scalar + JSONB `cart` column;
      `parseFloat()` on `reserve_verified_inr`
    - _Requirements: 4.1–4.6, 8.3_

  - [ ] 5.3 Update `dashboard/lib/read.ts` to delegate to `ReadLayer`
    - Replace all `readFileSync`/`readdirSync` implementations in the four exported functions
      (`readEventsSince`, `readCurrentMandate`, `readReceipts`, `readAuthorizations`) with
      delegation to a shared `ReadLayer` instance — all exported function signatures stay
      identical so API routes require zero changes
    - Keep `verifyChainLocal`, `verifyAuthorizationSignature`, `loadGatePublicKeyPem` unchanged
    - _Requirements: 4.5, 8.7_


- [ ] 6. `PurchaseJobStore` rewrite (`dashboard/lib/purchase-job.ts`)
  - [ ] 6.1 Implement `startPurchaseJob` and `getPurchaseJob` against Postgres
    - Remove the in-memory `jobs` Map, `MAX_JOBS` constant, `STORAGE_FILE` path,
      `loadJobsFromDisk`, `persistJobsToDisk`, and `evictOldestIfFull`
    - `startPurchaseJob`: synchronously `INSERT INTO purchase_jobs` with `status='running'`
      before calling `runAgentBuy`; use `dashboard/lib/db-pool.ts` pool (max 10)
    - `onLine` callback: wrap the seq-increment `INSERT INTO purchase_job_events` in a
      `BEGIN`/`COMMIT` transaction using
      `SELECT COALESCE(MAX(seq),0)+1 … FOR UPDATE` to prevent gaps under concurrency; after
      commit, issue `UPDATE purchase_jobs SET state=$2` outside the transaction (best-effort);
      on any DB error: `console.error` and return without rethrowing
    - On agent run completion: `UPDATE purchase_jobs SET status, state, finished_at`
    - `getPurchaseJob(id)`: `SELECT` from `purchase_jobs` joined with ordered
      `purchase_job_events ORDER BY seq ASC`; reconstruct `PurchaseJob` including `events[]`
    - _Requirements: 5.1–5.5, 5.7, 5.9, 5.10_

  - [ ] 6.2 Implement `hasBeenCleared` / `markCleared` and `getJobsBySession`
    - `markCleared`: `INSERT INTO cleared_merchants (session_id, merchant) VALUES ($1, $2)
      ON CONFLICT DO NOTHING`
    - `hasBeenCleared`: `SELECT 1 FROM cleared_merchants WHERE session_id=$1 AND merchant=$2`
    - `getJobsBySession(sessionId)`: query `purchase_jobs WHERE session_id=$1` then for each job
      fetch its ordered events from `purchase_job_events`; reconstruct full `PurchaseJob[]`
    - _Requirements: 5.6, 5.8_

- [ ] 7. Data migration script (`db/seed-from-files.ts`)
  - [ ] 7.1 Implement flat-file readers and per-table upsert logic
    - Exit with code 1 and descriptive message if `DATABASE_URL` is not set
    - Read `mandates/*.json` → `INSERT INTO mandates … ON CONFLICT (mandate_id) DO NOTHING`
    - Read `receipts/*.json` → `INSERT INTO receipts … ON CONFLICT (receipt_id) DO NOTHING`
    - Read `authorizations/*.json` → `INSERT INTO transaction_authorizations … ON CONFLICT DO NOTHING`
    - Read `events.jsonl` line-by-line → parse as `GateEvent`, skip blank/malformed lines with
      `console.warn`, insert with `ON CONFLICT (event_id) DO NOTHING`
    - _Requirements: 7.1–7.5, 7.9, 7.10_

  - [ ] 7.2 Implement ledger and purchase-job migration
    - Read `ledger.jsonl` → parse each line, skip entries missing `idempotency_key` with
      `console.warn`, insert with `ON CONFLICT (idempotency_key) DO NOTHING`
    - Read `dashboard/purchase_jobs_store.json` → for each `PurchaseJob` insert one
      `purchase_jobs` row and each element of `events[]` as a `purchase_job_events` row with
      `seq = arrayIndex + 1`; use `ON CONFLICT DO NOTHING` on both tables
    - Print per-table summary of inserted vs skipped counts on completion
    - _Requirements: 7.2, 7.3, 7.4, 7.6, 7.7, 7.8_

- [ ] 8. Checkpoint — schema, store, and read layer
  - Ensure all TypeScript files compile (`tsc --noEmit`). Run `db/migrate.ts` against a local
    Postgres instance to confirm schema applies cleanly and is idempotent. Ask the user if any
    questions arise before continuing.


- [ ] 9. Property-based tests (fast-check, all 12 design properties)
  - [ ] 9.1 Create `src/db/test/arbitraries.ts` — shared fast-check generators
    - Write `arbitraryMandate()`, `arbitraryGateEvent()`, `arbitraryReceipt()`,
      `arbitraryTransactionAuthorization()`, `arbitraryAgentLines()`
    - Use `fc.record` with `fc.constantFrom` for enum fields (`verdict`, `access`, `entry_type`)
      and `fc.date().map(d => d.toISOString())` for ISO timestamp fields
    - _Requirements: 3.2, 4.1, 5.3_

  - [ ]* 9.2 Write property test for Property 1: Domain object round-trip
    - File: `src/db/test/postgres-store.property.test.ts` using `node:test` + `fast-check`
    - Mock `pg.Pool` with an in-memory stub; assert `saveMandate` → `loadMandate` returns
      deeply equal value including JSONB fields and `parseFloat`-coerced NUMERIC fields
    - Repeat for `GateEvent` (via `appendEvent` + query stub), `Receipt`, `TransactionAuthorization`
    - Min 100 runs per property; tag comment: `// Property 1: Domain object round-trip`
    - **Property 1: Domain object round-trip**
    - **Validates: Requirements 3.2, 3.3 (partial), 4.5, 8.3, 8.4, 8.5, 8.6**

  - [ ]* 9.3 Write property test for Property 2: Upsert overwrites on conflict
    - Assert that calling `saveMandate` twice with the same `mandate_id` but different field
      values results in `loadMandate` returning the second (updated) value
    - **Property 2: Upsert overwrites on conflict**
    - **Validates: Requirements 3.3**

  - [ ]* 9.4 Write property test for Property 3: Ordered retrieval invariants
    - Generate a non-empty array of mandates with distinct `mandate_id` ULIDs in random
      insertion order; assert `loadAllMandates` returns them DESC by `mandate_id` and
      `readCurrentMandate` returns the lexicographically greatest one
    - **Property 3: Ordered retrieval invariants**
    - **Validates: Requirements 3.5, 4.2**

  - [ ]* 9.5 Write property test for Property 4: Chronological ordering for receipts and authorizations
    - Generate receipts with random `signed_at` timestamps; assert `loadAllReceipts` and
      `readReceipts` return them `signed_at ASC`
    - Generate `TransactionAuthorization` records; assert `readAuthorizations` returns them
      `authorized_at ASC`
    - **Property 4: Chronological ordering for receipts and authorizations**
    - **Validates: Requirements 3.7, 4.3, 4.4**

  - [ ]* 9.6 Write property test for Property 5: readEventsSince returns the correct subset
    - Generate N events with distinct `ts`; for any random `sinceId` present in the set assert
      only events with `ts > sinceTs` are returned; for null or unknown `sinceId` assert all
      events are returned
    - **Property 5: readEventsSince returns the correct subset**
    - **Validates: Requirements 4.1**

  - [ ]* 9.7 Write property test for Property 6: purchase_job_events seq is unique and gapless under concurrency
    - Generate N `AgentLine` events arriving via concurrent async calls; assert resulting
      `purchase_job_events` rows have `seq` values `{1..N}` — no duplicates, no gaps
    - **Property 6: purchase_job_events seq is unique and gapless under concurrency**
    - **Validates: Requirements 5.3, 5.9**

  - [ ]* 9.8 Write property test for Property 7: getPurchaseJob reconstructs full job including ordered events
    - Generate a job with N stored events; assert `getPurchaseJob` returns `events[]` with
      exactly N elements in ascending `seq` order, each deeply equal to the stored JSONB
    - **Property 7: getPurchaseJob reconstructs full job including ordered events**
    - **Validates: Requirements 5.5**

  - [ ]* 9.9 Write property test for Property 8: getJobsBySession returns exactly matching jobs
    - Generate jobs across multiple `sessionId` values; assert `getJobsBySession(sid)` returns
      exactly the jobs whose `session_id = sid` — no extras, no missing
    - **Property 8: getJobsBySession returns exactly matching jobs**
    - **Validates: Requirements 5.6**

  - [ ]* 9.10 Write property test for Property 9: hasBeenCleared / markCleared round-trip
    - For any `(sessionId, merchant)` pair: after `markCleared`, `hasBeenCleared` must return
      `true`; for any un-marked pair it must return `false`; results must be consistent after
      simulated restart (re-query from DB stub)
    - **Property 9: hasBeenCleared / markCleared round-trip**
    - **Validates: Requirements 5.8**

  - [ ]* 9.11 Write property test for Property 10: Ledger audit round-trip for both entry types
    - For any `(reserveRef, amountInrPaise, idempotencyKey)` triple: after a debit or credit
      insert, `getLedgerEntriesByReserve` includes the row with correct `entry_type`,
      `amount_inr_paise` (integer after `parseInt`), and `idempotency_key`; entries ordered
      `recorded_at ASC`
    - **Property 10: Ledger audit round-trip for both entry types**
    - **Validates: Requirements 6.1, 6.2, 6.5**

  - [ ]* 9.12 Write property test for Property 11: idempotency_key conflict is a no-op
    - For any `idempotency_key`: inserting the same key twice results in exactly one row;
      no error is raised on the second call
    - **Property 11: idempotency_key conflict is a no-op**
    - **Validates: Requirements 6.3**

  - [ ]* 9.13 Write property test for Property 12: getTotalDrawnForReserve equals sum of debit entries
    - For any `reserveRef` and list of debit `amount_inr_paise` values, assert
      `getTotalDrawnForReserve` returns their arithmetic sum; assert credit entries for the
      same reserve do not affect the result
    - **Property 12: getTotalDrawnForReserve equals sum of debit entries**
    - **Validates: Requirements 6.6**


- [ ] 10. Integration tests and smoke tests
  - [ ] 10.1 Write smoke tests for schema existence (`db/test/schema.smoke.test.ts`)
    - After running `db/migrate.ts` against a test database, assert all eight tables exist by
      querying `information_schema.tables` by name
    - Assert all fourteen indexes exist by name in `pg_indexes`
    - Assert `UNIQUE (job_id, seq)` constraint exists on `purchase_job_events`
    - _Requirements: 1.1–1.14, 2.2_

  - [ ]* 10.2 Write integration test for migrate.ts idempotency
    - Run `migrate.ts` twice against the same test database; assert the second run completes
      without error and produces the same schema (no duplicate tables or indexes)
    - _Requirements: 2.3_

  - [ ]* 10.3 Write integration tests for `PostgresStore` error-message parity
    - Assert `loadMandate('nonexistent')` throws `No mandate found with id "nonexistent"`
    - Assert `loadReceipt('nonexistent')` throws `No receipt found with id "nonexistent"`
    - Assert `loadAuthorization('nonexistent')` throws `No authorization found with id "nonexistent"`
    - Assert constructing `PostgresStore` without `DATABASE_URL` throws the expected message
    - _Requirements: 3.4, 3.6, 3.8, 3.11_

  - [ ]* 10.4 Write integration test for `seed-from-files.ts`
    - Place fixture JSON files and JSONL lines in a temp directory; run the seed script; assert
      printed summary counts match fixture counts; assert re-run prints zero inserted (all skipped)
    - _Requirements: 7.1–7.8_

- [ ] 11. Environment configuration
  - [ ] 11.1 Update `.env.example` and `dashboard/.env.local.example`
    - Add `DATABASE_URL=postgres://localhost:5432/mandate_gate` to `.env.example`
    - Add `DATABASE_URL=postgres://localhost:5432/mandate_gate` to
      `dashboard/.env.local.example`
    - _Requirements: 9.6, 9.7_

- [ ] 12. Final checkpoint — all tests pass
  - Run `node --test` from the repo root and from `dashboard/` to confirm all property tests,
    unit tests, and smoke tests pass. Ensure `tsc --noEmit` is clean. Ask the user if any
    questions arise.


---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references the specific requirements and design sections it satisfies
- All twelve correctness properties from `design.md § Correctness Properties` are covered by
  tasks 9.2–9.13; each property sub-task names the property and the requirements it validates
- `decide()` and all domain interfaces (`GateEvent`, `Mandate`, `Receipt`,
  `TransactionAuthorization`) are never touched — see Requirement 8
- The `pg` driver returns `NUMERIC` and `BIGINT` as strings; every read path must call
  `parseFloat()` / `parseInt()` before returning values to callers
- Pool teardown handlers must be registered in both `src/db/pool.ts` and
  `dashboard/lib/db-pool.ts` to prevent connection leaks

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1", "2.2"] },
    { "id": 2, "tasks": ["2.3", "2.4", "5.1"] },
    { "id": 3, "tasks": ["3.1", "4.1", "5.2"] },
    { "id": 4, "tasks": ["4.2", "5.3", "6.1", "6.2"] },
    { "id": 5, "tasks": ["7.1", "7.2", "9.1"] },
    { "id": 6, "tasks": ["9.2", "9.3", "9.4", "9.5", "9.6", "10.1"] },
    { "id": 7, "tasks": ["9.7", "9.8", "9.9", "9.10", "9.11", "9.12", "9.13", "10.2", "10.3"] },
    { "id": 8, "tasks": ["10.4", "11.1"] }
  ]
}
```