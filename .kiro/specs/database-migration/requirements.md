# Requirements Document

## Introduction

The Mandate Gate project currently uses flat files for all persistence: append-only JSONL logs, per-object JSON files for mandates/receipts/authorizations, a single overwritten JSON blob for purchase jobs, and a JSONL ledger audit trail. These flat-file stores exhibit known scaling problems — O(n) full-file scans on every dashboard poll, no indexed queries, a critical race condition in the purchase-job store, and unbounded file growth.

This feature migrates all six persistence points to a Postgres database while leaving the `decide()` function and all TypeScript domain interfaces (`GateEvent`, `Mandate`, `Receipt`, `TransactionAuthorization`) completely untouched. The migration introduces a `Store` abstraction layer, a DB-backed read layer for the dashboard, a proper jobs table with per-event rows, and a flat-file-to-Postgres data migration script. Key material (`keys/` PEM files) is explicitly excluded — it stays on disk.

---

## Glossary

- **Store**: The write abstraction implemented by `src/cli/store.ts`. After migration, `Store` is an interface with a Postgres-backed implementation. The function signatures visible to callers (`appendEvent`, `saveMandate`, `saveReceipt`, `saveAuthorization`) do not change.
- **ReadLayer**: The read abstraction used by `dashboard/lib/read.ts`. After migration, `ReadLayer` queries Postgres instead of scanning flat files.
- **GateEvent**: The TypeScript interface defined in `src/events/GateEvent.ts`. Its shape does not change. It maps to the `gate_events` table.
- **Mandate**: The TypeScript interface defined in `src/mandate/schema.ts`. Its shape does not change. It maps to the `mandates` table.
- **Receipt**: The TypeScript interface defined in `src/receipt/schema.ts`. Its shape does not change. It maps to the `receipts` table.
- **TransactionAuthorization**: The TypeScript interface defined in `src/receipt/authorization.ts`. Its shape does not change. It maps to the `transaction_authorizations` table.
- **PurchaseJob**: The interface defined in `dashboard/lib/purchase-job.ts`. After migration, the job header maps to `purchase_jobs` and each `AgentLine` event maps to a row in `purchase_job_events`.
- **LedgerEntry**: A draw or credit record written by `PravaCreditLedger`. Maps to the `ledger_entries` table.
- **Migration Script**: A one-shot Node.js script that reads all existing flat files and inserts their contents into Postgres. Safe to run on an empty database (no flat files) and idempotent on already-migrated records.
- **DATABASE_URL**: The Postgres connection string supplied via environment variable. Required by both the CLI and the dashboard.
- **decide()**: The pure, synchronous, zero-I/O policy function in `src/policy/decide.ts`. It MUST NOT be modified or called from any database path.
- **ULID**: Universally Unique Lexicographically Sortable Identifier. Used as the primary key format for `mandate_id`, `event_id`, `receipt_id`, etc. String sort order equals creation-time order.

---

## Requirements

### Requirement 1: Postgres Schema

**User Story:** As a developer, I want a well-defined Postgres schema that mirrors the existing TypeScript domain interfaces, so that all persistence points have proper tables, indexes, and foreign keys without changing any interface shapes.

#### Acceptance Criteria

1. THE Database SHALL contain a `gate_events` table with columns: `event_id` (text primary key), `ts` (timestamptz not null), `mandate_id` (text not null), `mandate_hash` (text not null), `command` (text not null), `access` (text not null, check: `read` or `write`), `verdict` (text not null, check: `ALLOW`, `DENY`, or `STEP_UP`), `code` (text nullable), `amount_inr` (numeric nullable), `run_id` (text nullable), `reserve_ref` (text nullable), `trace_digest` (text nullable).
2. THE Database SHALL contain a `mandates` table with columns: `mandate_id` (text primary key), `issuer` (text not null), `subject` (text not null), `scope` (jsonb not null), `reserve` (jsonb not null), `sig` (text not null), `created_at` (timestamptz not null default now()).
3. THE Database SHALL contain a `receipts` table with columns: `receipt_id` (text primary key), `authorization_id` (text not null references `transaction_authorizations(authorization_id)`), `mandate_hash` (text not null), `cart` (jsonb not null), `payment` (jsonb not null), `execution` (jsonb not null), `evidence` (jsonb not null), `prev_receipt_hash` (text not null), `signed_at` (timestamptz not null), `sig` (text not null).
4. THE Database SHALL contain a `transaction_authorizations` table with columns: `authorization_id` (text primary key), `run_id` (text not null), `mandate_id` (text not null), `mandate_hash` (text not null), `merchant` (text not null), `cart` (jsonb not null), `verdict` (text not null, check: `ALLOW`), `reserve_verified_inr` (numeric not null), `authorized_at` (timestamptz not null), `sig` (text not null).
5. THE Database SHALL contain a `purchase_jobs` table with columns: `id` (text primary key), `session_id` (text not null), `status` (text not null, check: `running`, `done`, or `failed`), `state` (text not null), `input` (jsonb not null), `started_at` (timestamptz not null), `finished_at` (timestamptz nullable).
6. THE Database SHALL contain a `purchase_job_events` table with columns: `id` (bigserial primary key), `job_id` (text not null references `purchase_jobs(id)`), `seq` (integer not null), `event` (jsonb not null), `recorded_at` (timestamptz not null default now()), with a unique constraint on `(job_id, seq)`.
7. THE Database SHALL contain a `ledger_entries` table with columns: `id` (bigserial primary key), `reserve_ref` (text not null), `entry_type` (text not null, check: `debit` or `credit`), `amount_inr_paise` (bigint not null), `idempotency_key` (text not null unique), `mandate_id` (text nullable), `run_id` (text nullable), `recorded_at` (timestamptz not null default now()).
8. THE Database SHALL define an index on `gate_events(mandate_id, ts)` to support the dashboard's per-mandate event queries.
9. THE Database SHALL define an index on `gate_events(ts)` to support the dashboard's `readEventsSince` query pattern.
10. THE Database SHALL define an index on `receipts(mandate_hash)` to support receipt chain lookups by mandate.
11. THE Database SHALL define an index on `transaction_authorizations(mandate_id)` to support authorization lookups by mandate.
12. THE Database SHALL define an index on `purchase_jobs(session_id)` to support session-scoped job queries.
13. THE Database SHALL define an index on `ledger_entries(reserve_ref)` to support per-reserve spending audits.
14. THE Database SHALL define an index on `purchase_job_events(job_id, seq)` to support ordered event retrieval per job.

---

### Requirement 2: Schema Migration Files

**User Story:** As a developer, I want versioned SQL migration files, so that the schema can be applied to a fresh database and tracked in version control.

#### Acceptance Criteria

1. THE Migration_Files SHALL be located at `db/migrations/` and named with a sequential numeric prefix (e.g. `001_initial_schema.sql`).
2. WHEN a migration file is applied to an empty database, THE Migration_Files SHALL create all tables, indexes, and constraints defined in Requirement 1 without errors.
3. THE Migration_Files SHALL be idempotent with respect to already-existing objects using `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` patterns.
4. THE Migration_Files SHALL include a `db/migrate.ts` runner script that applies all pending migration files in order using a `DATABASE_URL` environment variable.
5. WHEN `DATABASE_URL` is not set, THE migrate.ts runner SHALL throw an explicit error message before attempting any database connection.

---

### Requirement 3: Store Abstraction Layer

**User Story:** As a developer, I want `src/cli/store.ts` to implement against a `Store` interface backed by Postgres, so that the CLI's write path has a single, testable persistence contract without changing caller signatures.

#### Acceptance Criteria

1. THE Store_Interface SHALL define functions: `appendEvent(event: GateEvent): Promise<void>`, `saveMandate(mandate: Mandate): Promise<void>`, `loadMandate(mandateId: string): Promise<Mandate>`, `loadAllMandates(): Promise<Mandate[]>`, `saveReceipt(receipt: Receipt): Promise<void>`, `loadReceipt(receiptId: string): Promise<Receipt>`, `loadAllReceipts(): Promise<Receipt[]>`, `saveAuthorization(auth: TransactionAuthorization): Promise<void>`, `loadAuthorization(authorizationId: string): Promise<TransactionAuthorization>`, `loadAllAuthorizations(): Promise<TransactionAuthorization[]>`.
2. THE PostgresStore SHALL implement the `Store` interface using parameterized SQL queries against the schema defined in Requirement 1.
3. WHEN `saveMandate` is called with a `mandate_id` that already exists, THE PostgresStore SHALL upsert the row (overwrite on conflict) to support the `gate mandate resign` workflow.
4. WHEN `loadMandate` is called with a non-existent `mandate_id`, THE PostgresStore SHALL throw an error with the same message shape as the current flat-file implementation: `No mandate found with id "${mandateId}"`.
5. WHEN `loadAllMandates` is called, THE PostgresStore SHALL return all mandates ordered by `mandate_id` descending (latest ULID first), mirroring the existing string-sort behavior.
6. WHEN `loadReceipt` is called with a non-existent `receipt_id`, THE PostgresStore SHALL throw an error with the message: `No receipt found with id "${receiptId}"`.
7. WHEN `loadAllReceipts` is called, THE PostgresStore SHALL return all receipts ordered by `signed_at` ascending, preserving chain order for chain verification.
8. WHEN `loadAuthorization` is called with a non-existent `authorization_id`, THE PostgresStore SHALL throw an error with the message: `No authorization found with id "${authorizationId}"`.
9. THE PostgresStore SHALL use parameterized queries for all SQL statements — no string interpolation of user-supplied or domain-supplied values into query text.
10. THE Store_Module SHALL export a singleton `store` instance initialized from `DATABASE_URL`, and `src/cli/store.ts` SHALL re-export the `Store` interface functions from this singleton so that all existing callers require zero changes.
11. WHEN `DATABASE_URL` is not set at module load time, THE Store_Module SHALL throw an explicit error message before any database operation is attempted.

---

### Requirement 4: Dashboard Read Layer

**User Story:** As a developer, I want `dashboard/lib/read.ts` to query Postgres instead of scanning flat files, so that the dashboard's polling routes have O(1) or O(log n) query cost regardless of data volume.

#### Acceptance Criteria

1. THE ReadLayer SHALL implement `readEventsSince(sinceId: string | null): Promise<GateEvent[]>` by querying `gate_events` ordered by `ts` ascending, returning only rows where `ts` is greater than the `ts` of the event matching `sinceId`, or all rows if `sinceId` is null or not found.
2. THE ReadLayer SHALL implement `readCurrentMandate(): Promise<Mandate | null>` by querying `SELECT * FROM mandates ORDER BY mandate_id DESC LIMIT 1` — no file scan.
3. THE ReadLayer SHALL implement `readReceipts(): Promise<Receipt[]>` by querying `SELECT * FROM receipts ORDER BY signed_at ASC`.
4. THE ReadLayer SHALL implement `readAuthorizations(): Promise<TransactionAuthorization[]>` by querying `SELECT * FROM transaction_authorizations ORDER BY authorized_at ASC`.
5. WHEN a query returns a row, THE ReadLayer SHALL reconstruct the original TypeScript interface value exactly — including deserializing `scope`, `reserve`, `cart`, `payment`, `execution`, and `evidence` JSONB columns back into their typed sub-object shapes — so that existing callers of `read.ts` require zero changes.
6. WHEN a database query fails due to a transient connection error, THE ReadLayer SHALL propagate the error to the calling API route, which is responsible for returning an appropriate HTTP error response.
7. THE ReadLayer SHALL use a connection pool (max 10 connections) shared across all dashboard API routes, initialized from `DATABASE_URL`.
8. WHEN `DATABASE_URL` is not set, THE ReadLayer SHALL throw an explicit error at module load time before any query is attempted.

---

### Requirement 5: Purchase Job Store Migration

**User Story:** As a developer, I want the purchase job store to use a Postgres-backed `purchase_jobs` table with per-event rows, so that concurrent jobs do not race on a shared file, job history survives process restarts, and jobs can be queried by session.

#### Acceptance Criteria

1. THE PurchaseJobStore SHALL replace the `purchase_jobs_store.json` file-based store with inserts and updates against the `purchase_jobs` and `purchase_job_events` tables defined in Requirement 1.
2. WHEN `startPurchaseJob` is called, THE PurchaseJobStore SHALL insert a new row into `purchase_jobs` with `status = 'running'` and the initial state, within the same call, before the async agent run begins.
3. WHEN an `AgentLine` event arrives via the `onLine` callback, THE PurchaseJobStore SHALL insert one row into `purchase_job_events` with the event as a JSONB value and the correct `seq` number (1-based, incrementing per job), and then update the `state` column of the corresponding `purchase_jobs` row.
4. WHEN `startPurchaseJob` completes (resolve or reject), THE PurchaseJobStore SHALL update the `purchase_jobs` row to set `status` (`done` or `failed`), `state`, and `finished_at`.
5. WHEN `getPurchaseJob` is called, THE PurchaseJobStore SHALL reconstruct the full `PurchaseJob` object — including the `events[]` array — by joining `purchase_jobs` with an ordered query of `purchase_job_events(job_id, seq)`.
6. THE PurchaseJobStore SHALL expose `getJobsBySession(sessionId: string): Promise<PurchaseJob[]>` to support session-scoped job listing.
7. THE PurchaseJobStore SHALL remove the in-memory `jobs` Map, the `MAX_JOBS` eviction cap, and the `persistJobsToDisk` / `loadJobsFromDisk` functions.
8. THE PurchaseJobStore SHALL preserve the `hasBeenCleared` / `markCleared` behavior using a `cleared_merchants` table with columns: `session_id` (text), `merchant` (text), primary key `(session_id, merchant)`.
9. WHEN two `AgentLine` events arrive concurrently for the same job, THE PurchaseJobStore SHALL serialize their inserts such that `seq` values are unique and gapless per job (no duplicate seq, no skipped seq under concurrent writes).
10. IF a database write fails while recording a job event, THE PurchaseJobStore SHALL log the error and continue the agent run — a persistence failure MUST NOT kill the running purchase job.

---

### Requirement 6: Ledger Audit Table

**User Story:** As a developer, I want all Prava draw and credit operations to be recorded in a `ledger_entries` table, so that spending history for any reserve can be audited without scanning a JSONL file.

#### Acceptance Criteria

1. THE LedgerAuditStore SHALL write one row to `ledger_entries` for every call to `PravaCreditLedger.draw()`, capturing: `reserve_ref`, `entry_type = 'debit'`, `amount_inr_paise`, `idempotency_key` (the `runId`), and `run_id`.
2. THE LedgerAuditStore SHALL write one row to `ledger_entries` for every call to `PravaCreditLedger.credit()`, capturing: `reserve_ref`, `entry_type = 'credit'`, `amount_inr_paise`, `idempotency_key`.
3. WHEN a `ledger_entries` insert is attempted with a `idempotency_key` that already exists, THE LedgerAuditStore SHALL treat the conflict as a no-op (insert ON CONFLICT DO NOTHING) — the Prava API call may already be idempotent, and the local audit record must be too.
4. IF a `ledger_entries` write fails, THE LedgerAuditStore SHALL log the error but MUST NOT prevent the Prava API call from completing — the Prava-hosted ledger is authoritative; the local table is an audit trail.
5. THE LedgerAuditStore SHALL expose `getLedgerEntriesByReserve(reserveRef: string): Promise<LedgerEntry[]>` returning all entries ordered by `recorded_at` ascending to support per-reserve spending audits.
6. THE LedgerAuditStore SHALL expose `getTotalDrawnForReserve(reserveRef: string): Promise<number>` returning the sum of all `debit` entries for a given `reserve_ref` in INR paise.

---

### Requirement 7: Flat-File to Postgres Data Migration Script

**User Story:** As a developer, I want a one-shot migration script that reads all existing flat files and inserts their contents into Postgres, so that existing demo data is not lost when switching to the database-backed store.

#### Acceptance Criteria

1. THE Migration_Script SHALL be located at `db/seed-from-files.ts` and executable via `ts-node db/seed-from-files.ts`.
2. WHEN executed, THE Migration_Script SHALL read all files from `mandates/*.json`, `receipts/*.json`, `authorizations/*.json`, `events.jsonl`, `ledger.jsonl`, and `dashboard/purchase_jobs_store.json` if they exist, and insert their contents into the corresponding Postgres tables.
3. WHEN a flat-file record already exists in Postgres (matching primary key), THE Migration_Script SHALL skip that record without error, making the script safe to run multiple times.
4. WHEN a flat-file record fails to parse or fails validation (e.g. `isMandate()` returns false), THE Migration_Script SHALL log a warning and skip that record — it MUST NOT abort the entire migration.
5. WHEN `events.jsonl` is migrated, THE Migration_Script SHALL parse each line as a `GateEvent`, skipping blank lines and malformed lines with a warning.
6. WHEN `ledger.jsonl` is migrated, THE Migration_Script SHALL parse each line as a ledger entry (draw or credit), mapping the `idempotency_key` field; entries without a unique `idempotency_key` SHALL be logged as warnings and skipped.
7. WHEN `dashboard/purchase_jobs_store.json` is migrated, THE Migration_Script SHALL insert each job into `purchase_jobs` and each element of the job's `events[]` array as a separate row in `purchase_job_events` with `seq` matching the array index + 1.
8. WHEN the migration completes, THE Migration_Script SHALL print a summary: counts of records inserted and skipped per table.
9. WHEN `DATABASE_URL` is not set, THE Migration_Script SHALL exit with a non-zero code and a descriptive error message before reading any files.
10. THE Migration_Script SHALL NOT modify or delete any flat files — the original files remain intact as a backup.

---

### Requirement 8: decide() and Domain Interface Immutability

**User Story:** As a developer, I want the database migration to be purely an infrastructure change, so that the core policy logic and all public domain interfaces remain unchanged and require no modification.

#### Acceptance Criteria

1. THE PolicyEngine's `decide()` function SHALL remain a pure, synchronous, zero-I/O function — it SHALL NOT import from any database module, connection pool, or async store.
2. THE GateEvent interface, THE Mandate interface, THE Receipt interface, and THE TransactionAuthorization interface SHALL NOT have any fields added, removed, or renamed as part of this migration.
3. THE Store implementation SHALL map TypeScript interface fields to database columns without loss — every field present in the TypeScript interface SHALL be persisted and fully round-tripped back to the same TypeScript value when loaded.
4. WHEN the database layer serializes a `Mandate` to the `mandates` table, THE Store SHALL store `scope` as a JSONB column and `reserve` as a JSONB column — the top-level typed fields (`mandate_id`, `issuer`, `subject`, `sig`) SHALL be stored as individual typed columns, not collapsed into a single JSON blob.
5. WHEN the database layer serializes a `Receipt` to the `receipts` table, THE Store SHALL store `cart`, `payment`, `execution`, and `evidence` as individual JSONB columns — `receipt_id`, `authorization_id`, `mandate_hash`, `prev_receipt_hash`, `signed_at`, and `sig` SHALL be stored as individual typed columns.
6. WHEN the database layer serializes a `TransactionAuthorization`, THE Store SHALL store `cart` as a JSONB column — all other scalar fields SHALL be individual typed columns.
7. THE `src/cli/store.ts` module's exported function signatures SHALL NOT change — callers of `appendEvent`, `saveMandate`, `loadMandate`, `saveReceipt`, `loadReceipt`, `loadAllReceipts`, `saveAuthorization`, `loadAuthorization`, `loadAllAuthorizations`, and `loadAllMandates` SHALL require no code changes.

---

### Requirement 9: Connection Management and Environment Configuration

**User Story:** As a developer, I want database connections to be managed safely and configured from environment variables, so that the CLI and dashboard share a consistent, leak-free connection model.

#### Acceptance Criteria

1. THE Store_Module SHALL use a single connection pool (pg `Pool`) shared for all CLI write operations, initialized lazily on first use, with a max connection count of 5.
2. THE ReadLayer SHALL use a separate connection pool for dashboard read operations, with a max connection count of 10.
3. WHEN the process exits cleanly (SIGINT, SIGTERM, or normal exit), THE Store_Module and THE ReadLayer SHALL each call `pool.end()` to release all connections.
4. THE CLI SHALL read `DATABASE_URL` from its environment (the `.env` file at the repo root, loaded by the existing env-loading mechanism).
5. THE Dashboard SHALL read `DATABASE_URL` from its own `.env.local` file (already the convention for `dashboard/` environment variables).
6. THE `.env.example` file at the repo root SHALL include a `DATABASE_URL` entry with a placeholder Postgres connection string to document the required variable.
7. THE `dashboard/.env.local.example` file SHALL include a `DATABASE_URL` entry with a placeholder Postgres connection string.
8. WHEN a database operation times out after 30 seconds, THE Store_Module SHALL propagate the error to the caller with a message that identifies the operation that timed out, rather than hanging indefinitely.