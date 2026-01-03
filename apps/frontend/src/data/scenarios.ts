import type { IsolationLevel } from '@isolation-demo/shared';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ScenarioStep {
  terminal: 1 | 2 | 3;
  sql: string;
  explanation: string;
  expectation?: string;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  difficulty: 'basic' | 'intermediate' | 'advanced';
  category: 'read-anomalies' | 'write-anomalies' | 'locks' | 'deadlocks';
  terminals: 2 | 3;
  setup: {
    isolationLevels: [IsolationLevel, IsolationLevel, IsolationLevel?];
  };
  steps: ScenarioStep[];
  conclusion: {
    problem: string;
    solution: string;
  };
}

// ─────────────────────────────────────────────
// Read Anomalies
// ─────────────────────────────────────────────

const dirtyRead: Scenario = {
  id: 'dirty-read',
  title: 'Dirty Read (PostgreSQL Protection)',
  description: 'Why PostgreSQL never allows dirty reads, even in READ UNCOMMITTED',
  difficulty: 'basic',
  category: 'read-anomalies',
  terminals: 2,
  setup: {
    isolationLevels: ['READ UNCOMMITTED', 'READ UNCOMMITTED'],
  },
  steps: [
    {
      terminal: 1,
      sql: 'BEGIN;',
      explanation: 'Start transaction 1 in READ UNCOMMITTED mode.',
    },
    {
      terminal: 1,
      sql: 'UPDATE accounts SET balance = 9999 WHERE id = 1;',
      explanation: 'Update balance but do NOT commit yet.',
    },
    {
      terminal: 2,
      sql: 'BEGIN;',
      explanation: 'Start transaction 2, also in READ UNCOMMITTED.',
    },
    {
      terminal: 2,
      sql: 'SELECT balance FROM accounts WHERE id = 1;',
      explanation: 'Try to read the uncommitted change.',
      expectation:
        '✅ Returns 1000, NOT 9999! PostgreSQL treats READ UNCOMMITTED as READ COMMITTED.',
    },
    {
      terminal: 1,
      sql: 'ROLLBACK;',
      explanation: 'Rollback the change. The 9999 value never existed for other sessions.',
    },
    {
      terminal: 2,
      sql: 'COMMIT;',
      explanation: 'End transaction 2.',
    },
  ],
  conclusion: {
    problem:
      'Dirty reads allow seeing uncommitted data that might be rolled back, leading to decisions based on phantom data.',
    solution:
      'PostgreSQL protects you automatically — READ UNCOMMITTED behaves as READ COMMITTED. Other databases (MySQL, SQL Server) do allow dirty reads.',
  },
};

const nonRepeatableRead: Scenario = {
  id: 'non-repeatable-read',
  title: 'Non-repeatable Read',
  description: 'Same SELECT returns different data within one transaction',
  difficulty: 'basic',
  category: 'read-anomalies',
  terminals: 2,
  setup: {
    isolationLevels: ['READ COMMITTED', 'READ COMMITTED'],
  },
  steps: [
    {
      terminal: 1,
      sql: 'BEGIN;',
      explanation: 'Start a transaction in READ COMMITTED mode.',
    },
    {
      terminal: 1,
      sql: 'SELECT balance FROM accounts WHERE id = 1;',
      explanation: 'Read the balance. Remember this value (1000).',
    },
    {
      terminal: 2,
      sql: 'UPDATE accounts SET balance = 500 WHERE id = 1;',
      explanation: 'Another session updates the same row. This commits immediately (autocommit).',
    },
    {
      terminal: 1,
      sql: 'SELECT balance FROM accounts WHERE id = 1;',
      explanation: 'Read again in the same transaction.',
      expectation: '⚠️ Balance is now 500! The data changed within your transaction.',
    },
    {
      terminal: 1,
      sql: 'COMMIT;',
      explanation: 'End the transaction.',
    },
  ],
  conclusion: {
    problem:
      'In READ COMMITTED, each query sees the latest committed data. This means repeated reads can return different values.',
    solution: 'Use REPEATABLE READ to get a consistent snapshot for the entire transaction.',
  },
};

const phantomRead: Scenario = {
  id: 'phantom-read',
  title: 'Phantom Read',
  description: 'New rows appear in repeated queries within a transaction',
  difficulty: 'basic',
  category: 'read-anomalies',
  terminals: 2,
  setup: {
    isolationLevels: ['READ COMMITTED', 'READ COMMITTED'],
  },
  steps: [
    {
      terminal: 1,
      sql: 'BEGIN;',
      explanation: 'Start a transaction in READ COMMITTED mode.',
    },
    {
      terminal: 1,
      sql: 'SELECT * FROM accounts WHERE balance >= 500;',
      explanation: 'Find all accounts with balance >= 500. Remember the count.',
    },
    {
      terminal: 2,
      sql: "INSERT INTO accounts (name, balance) VALUES ('Ghost', 700);",
      explanation: 'Another session inserts a new row that matches our criteria.',
    },
    {
      terminal: 1,
      sql: 'SELECT * FROM accounts WHERE balance >= 500;',
      explanation: 'Run the same query again.',
      expectation: '👻 A new row appeared! This is a phantom read.',
    },
    {
      terminal: 1,
      sql: 'COMMIT;',
      explanation: 'End the transaction.',
    },
  ],
  conclusion: {
    problem:
      'Phantom reads occur when new rows match your query criteria. Unlike non-repeatable reads (existing rows change), phantoms are entirely new rows.',
    solution:
      'Use REPEATABLE READ (PostgreSQL prevents phantoms here) or SERIALIZABLE for full protection.',
  },
};

const repeatableReadProtection: Scenario = {
  id: 'repeatable-read-protection',
  title: 'REPEATABLE READ Protection',
  description: 'How REPEATABLE READ prevents non-repeatable and phantom reads',
  difficulty: 'basic',
  category: 'read-anomalies',
  terminals: 2,
  setup: {
    isolationLevels: ['REPEATABLE READ', 'READ COMMITTED'],
  },
  steps: [
    {
      terminal: 1,
      sql: 'BEGIN;',
      explanation: 'Start a transaction in REPEATABLE READ mode. This takes a snapshot.',
    },
    {
      terminal: 1,
      sql: 'SELECT * FROM accounts;',
      explanation: 'Read all accounts. This is your snapshot.',
    },
    {
      terminal: 2,
      sql: 'UPDATE accounts SET balance = 1 WHERE id = 1;',
      explanation: 'Another session modifies a row.',
    },
    {
      terminal: 2,
      sql: "INSERT INTO accounts (name, balance) VALUES ('New Account', 999);",
      explanation: 'Another session inserts a new row.',
    },
    {
      terminal: 1,
      sql: 'SELECT * FROM accounts;',
      explanation: 'Read again in REPEATABLE READ transaction.',
      expectation: '✅ Same data as before! No changes visible — snapshot isolation.',
    },
    {
      terminal: 1,
      sql: 'COMMIT;',
      explanation: 'End transaction. Now you would see the changes.',
    },
  ],
  conclusion: {
    problem: 'READ COMMITTED shows changes from other transactions between queries.',
    solution:
      'REPEATABLE READ takes a snapshot at transaction start. All queries see consistent data regardless of concurrent changes.',
  },
};

// ─────────────────────────────────────────────
// Write Anomalies
// ─────────────────────────────────────────────

const lostUpdate: Scenario = {
  id: 'lost-update',
  title: 'Lost Update',
  description: 'Two concurrent updates — one overwrites the other',
  difficulty: 'intermediate',
  category: 'write-anomalies',
  terminals: 2,
  setup: {
    isolationLevels: ['READ COMMITTED', 'READ COMMITTED'],
  },
  steps: [
    {
      terminal: 1,
      sql: 'BEGIN;',
      explanation: 'Start transaction 1. We want to add 100 to balance.',
    },
    {
      terminal: 1,
      sql: 'SELECT balance FROM accounts WHERE id = 1;',
      explanation: 'Read current balance: 1000. We plan to set it to 1100.',
    },
    {
      terminal: 2,
      sql: 'BEGIN;',
      explanation: 'Start transaction 2. We also want to add 200 to balance.',
    },
    {
      terminal: 2,
      sql: 'SELECT balance FROM accounts WHERE id = 1;',
      explanation: 'Read current balance: also sees 1000. Plans to set it to 1200.',
    },
    {
      terminal: 1,
      sql: 'UPDATE accounts SET balance = 1100 WHERE id = 1;',
      explanation: 'Transaction 1 writes 1000 + 100 = 1100.',
    },
    {
      terminal: 1,
      sql: 'COMMIT;',
      explanation: 'Transaction 1 commits. Balance is now 1100.',
    },
    {
      terminal: 2,
      sql: 'UPDATE accounts SET balance = 1200 WHERE id = 1;',
      explanation: 'Transaction 2 writes 1000 + 200 = 1200.',
      expectation: '⚠️ This overwrites the +100 from transaction 1!',
    },
    {
      terminal: 2,
      sql: 'COMMIT;',
      explanation: 'Transaction 2 commits.',
    },
    {
      terminal: 1,
      sql: 'SELECT balance FROM accounts WHERE id = 1;',
      explanation: 'Check final balance.',
      expectation: '💸 Balance is 1200, not 1300! We lost the +100 update.',
    },
  ],
  conclusion: {
    problem:
      'Both transactions read the same initial value, then write based on that stale read. The first write gets overwritten.',
    solution:
      'Use SELECT FOR UPDATE to lock the row while reading, or use atomic UPDATE (balance = balance + 100).',
  },
};

const lostUpdatePrevention: Scenario = {
  id: 'lost-update-prevention',
  title: 'Preventing Lost Update with FOR UPDATE',
  description: 'How SELECT FOR UPDATE prevents lost updates',
  difficulty: 'intermediate',
  category: 'write-anomalies',
  terminals: 2,
  setup: {
    isolationLevels: ['READ COMMITTED', 'READ COMMITTED'],
  },
  steps: [
    {
      terminal: 1,
      sql: 'BEGIN;',
      explanation: 'Start transaction 1.',
    },
    {
      terminal: 1,
      sql: 'SELECT balance FROM accounts WHERE id = 1 FOR UPDATE;',
      explanation: 'Read AND lock the row. No one else can modify it until we commit.',
    },
    {
      terminal: 2,
      sql: 'BEGIN;',
      explanation: 'Start transaction 2.',
    },
    {
      terminal: 2,
      sql: 'SELECT balance FROM accounts WHERE id = 1 FOR UPDATE;',
      explanation: 'Try to read and lock the same row.',
      expectation: '⏳ Transaction 2 is BLOCKED waiting for the lock.',
    },
    {
      terminal: 1,
      sql: 'UPDATE accounts SET balance = balance + 100 WHERE id = 1;',
      explanation: 'Transaction 1 updates the balance.',
    },
    {
      terminal: 1,
      sql: 'COMMIT;',
      explanation: 'Transaction 1 commits and releases the lock.',
    },
    {
      terminal: 2,
      sql: '',
      explanation: 'Transaction 2 now gets the lock and sees the NEW balance (1100).',
      expectation: '✅ Transaction 2 waited and now sees 1100, not 1000!',
    },
    {
      terminal: 2,
      sql: 'UPDATE accounts SET balance = balance + 200 WHERE id = 1;',
      explanation: 'Transaction 2 adds to the correct current balance.',
    },
    {
      terminal: 2,
      sql: 'COMMIT;',
      explanation: 'Final balance is 1300 — both updates preserved!',
    },
  ],
  conclusion: {
    problem: 'Without locking, concurrent reads get stale data.',
    solution:
      'FOR UPDATE locks the row until transaction ends. Other transactions wait and see fresh data.',
  },
};

const writeSkew: Scenario = {
  id: 'write-skew',
  title: 'Write Skew Anomaly',
  description: 'Two valid transactions together violate a constraint',
  difficulty: 'advanced',
  category: 'write-anomalies',
  terminals: 2,
  setup: {
    isolationLevels: ['REPEATABLE READ', 'REPEATABLE READ'],
  },
  steps: [
    {
      terminal: 1,
      sql: 'BEGIN;',
      explanation: 'Scenario: At least one account must have balance >= 500. Both start at 1000.',
    },
    {
      terminal: 1,
      sql: 'SELECT SUM(balance) FROM accounts WHERE id IN (1, 2);',
      explanation: 'Check total: 2000. We want to withdraw 600 from account 1.',
    },
    {
      terminal: 2,
      sql: 'BEGIN;',
      explanation: 'Transaction 2 also wants to withdraw.',
    },
    {
      terminal: 2,
      sql: 'SELECT SUM(balance) FROM accounts WHERE id IN (1, 2);',
      explanation: 'Also sees total: 2000. Wants to withdraw 600 from account 2.',
    },
    {
      terminal: 1,
      sql: 'UPDATE accounts SET balance = balance - 600 WHERE id = 1;',
      explanation: 'Transaction 1: Account 1 → 400. Total would be 1400. OK!',
    },
    {
      terminal: 2,
      sql: 'UPDATE accounts SET balance = balance - 600 WHERE id = 2;',
      explanation: 'Transaction 2: Account 2 → 400. Based on snapshot, total = 1400. OK!',
    },
    {
      terminal: 1,
      sql: 'COMMIT;',
      explanation: 'Transaction 1 commits.',
    },
    {
      terminal: 2,
      sql: 'COMMIT;',
      explanation: 'Transaction 2 commits.',
      expectation: '💥 Both accounts now have 400! Total is 800, not 1400.',
    },
  ],
  conclusion: {
    problem:
      'Write skew: each transaction checks a constraint, modifies different rows, but together they violate the constraint. REPEATABLE READ cannot detect this.',
    solution:
      'Use SERIALIZABLE isolation, or SELECT FOR UPDATE on all rows involved in the constraint check.',
  },
};

const serializableProtection: Scenario = {
  id: 'serializable-protection',
  title: 'SERIALIZABLE Prevents Write Skew',
  description: 'How SERIALIZABLE detects and prevents write skew',
  difficulty: 'advanced',
  category: 'write-anomalies',
  terminals: 2,
  setup: {
    isolationLevels: ['SERIALIZABLE', 'SERIALIZABLE'],
  },
  steps: [
    {
      terminal: 1,
      sql: 'BEGIN;',
      explanation: 'Start transaction 1 in SERIALIZABLE mode.',
    },
    {
      terminal: 1,
      sql: 'SELECT SUM(balance) FROM accounts WHERE id IN (1, 2);',
      explanation: 'Read total balance.',
    },
    {
      terminal: 2,
      sql: 'BEGIN;',
      explanation: 'Start transaction 2 in SERIALIZABLE mode.',
    },
    {
      terminal: 2,
      sql: 'SELECT SUM(balance) FROM accounts WHERE id IN (1, 2);',
      explanation: 'Also read total balance.',
    },
    {
      terminal: 1,
      sql: 'UPDATE accounts SET balance = balance - 600 WHERE id = 1;',
      explanation: 'Transaction 1 withdraws from account 1.',
    },
    {
      terminal: 2,
      sql: 'UPDATE accounts SET balance = balance - 600 WHERE id = 2;',
      explanation: 'Transaction 2 withdraws from account 2.',
    },
    {
      terminal: 1,
      sql: 'COMMIT;',
      explanation: 'Transaction 1 commits successfully.',
    },
    {
      terminal: 2,
      sql: 'COMMIT;',
      explanation: 'Transaction 2 tries to commit.',
      expectation: '🛡️ ERROR: could not serialize access. PostgreSQL detected the conflict!',
    },
  ],
  conclusion: {
    problem: 'Write skew is undetectable at lower isolation levels.',
    solution:
      'SERIALIZABLE uses predicate locking to detect conflicts. One transaction must retry. This is the only way to prevent all anomalies without explicit locking.',
  },
};

// ─────────────────────────────────────────────
// Locks
// ─────────────────────────────────────────────

const lockWait: Scenario = {
  id: 'lock-wait',
  title: 'Lock Wait Behavior',
  description: 'How transactions wait for locks held by others',
  difficulty: 'basic',
  category: 'locks',
  terminals: 2,
  setup: {
    isolationLevels: ['READ COMMITTED', 'READ COMMITTED'],
  },
  steps: [
    {
      terminal: 1,
      sql: 'BEGIN;',
      explanation: 'Start transaction 1.',
    },
    {
      terminal: 1,
      sql: 'UPDATE accounts SET balance = balance + 100 WHERE id = 1;',
      explanation: 'Update row — this acquires a row lock.',
    },
    {
      terminal: 2,
      sql: 'UPDATE accounts SET balance = balance + 200 WHERE id = 1;',
      explanation: 'Try to update the same row.',
      expectation: '⏳ Terminal 2 is WAITING. The row is locked by Terminal 1.',
    },
    {
      terminal: 1,
      sql: 'SELECT pg_sleep(3);',
      explanation: 'Hold the lock for 3 seconds to observe the wait.',
    },
    {
      terminal: 1,
      sql: 'COMMIT;',
      explanation: 'Release the lock.',
      expectation: '✅ Terminal 2 immediately completes its UPDATE.',
    },
  ],
  conclusion: {
    problem: 'When a row is locked, other transactions must wait.',
    solution:
      'Keep transactions short. Use NOWAIT or lock_timeout to fail fast instead of waiting indefinitely.',
  },
};

const forShareLock: Scenario = {
  id: 'for-share-lock',
  title: 'FOR SHARE — Shared Lock',
  description: 'Multiple readers, but block writers',
  difficulty: 'intermediate',
  category: 'locks',
  terminals: 2,
  setup: {
    isolationLevels: ['READ COMMITTED', 'READ COMMITTED'],
  },
  steps: [
    {
      terminal: 1,
      sql: 'BEGIN;',
      explanation: 'Start transaction 1.',
    },
    {
      terminal: 1,
      sql: 'SELECT * FROM accounts WHERE id = 1 FOR SHARE;',
      explanation:
        'Acquire a SHARE lock — others can also FOR SHARE, but not FOR UPDATE or UPDATE.',
    },
    {
      terminal: 2,
      sql: 'BEGIN;',
      explanation: 'Start transaction 2.',
    },
    {
      terminal: 2,
      sql: 'SELECT * FROM accounts WHERE id = 1 FOR SHARE;',
      explanation: 'Another FOR SHARE on the same row.',
      expectation: '✅ Works! Multiple SHARE locks are compatible.',
    },
    {
      terminal: 2,
      sql: 'UPDATE accounts SET balance = 500 WHERE id = 1;',
      explanation: 'Try to UPDATE the shared-locked row.',
      expectation: '⏳ BLOCKED! Cannot write while SHARE locks are held.',
    },
    {
      terminal: 1,
      sql: 'COMMIT;',
      explanation: 'Release the share lock from Terminal 1.',
      expectation: '✅ Terminal 2 UPDATE now proceeds.',
    },
    {
      terminal: 2,
      sql: 'COMMIT;',
      explanation: 'Complete transaction 2.',
    },
  ],
  conclusion: {
    problem: 'FOR UPDATE is too restrictive when you only need to prevent writes.',
    solution:
      'FOR SHARE allows concurrent readers while blocking writers. Useful for "read then validate" patterns.',
  },
};

const skipLocked: Scenario = {
  id: 'skip-locked',
  title: 'SKIP LOCKED — Job Queue Pattern',
  description: 'Skip locked rows instead of waiting',
  difficulty: 'intermediate',
  category: 'locks',
  terminals: 2,
  setup: {
    isolationLevels: ['READ COMMITTED', 'READ COMMITTED'],
  },
  steps: [
    {
      terminal: 1,
      sql: 'BEGIN;',
      explanation: 'Worker 1 starts processing.',
    },
    {
      terminal: 1,
      sql: 'SELECT * FROM accounts ORDER BY id LIMIT 1 FOR UPDATE;',
      explanation: 'Worker 1 claims the first row (id=1) for processing.',
    },
    {
      terminal: 2,
      sql: 'BEGIN;',
      explanation: 'Worker 2 starts processing.',
    },
    {
      terminal: 2,
      sql: 'SELECT * FROM accounts ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED;',
      explanation: 'Worker 2 tries to claim a row, SKIPPING any locked rows.',
      expectation: '✅ Returns id=2! Worker 2 skipped the locked row and got the next one.',
    },
    {
      terminal: 1,
      sql: 'COMMIT;',
      explanation: 'Worker 1 finishes.',
    },
    {
      terminal: 2,
      sql: 'COMMIT;',
      explanation: 'Worker 2 finishes.',
    },
  ],
  conclusion: {
    problem:
      'In a job queue, workers should not wait for each other — they should grab different jobs.',
    solution:
      'SKIP LOCKED returns only unlocked rows. Perfect for parallel job processing without coordination.',
  },
};

const nowait: Scenario = {
  id: 'nowait',
  title: 'NOWAIT — Fail Fast',
  description: 'Error immediately instead of waiting for locks',
  difficulty: 'intermediate',
  category: 'locks',
  terminals: 2,
  setup: {
    isolationLevels: ['READ COMMITTED', 'READ COMMITTED'],
  },
  steps: [
    {
      terminal: 1,
      sql: 'BEGIN;',
      explanation: 'Start transaction 1.',
    },
    {
      terminal: 1,
      sql: 'SELECT * FROM accounts WHERE id = 1 FOR UPDATE;',
      explanation: 'Lock row id=1.',
    },
    {
      terminal: 2,
      sql: 'BEGIN;',
      explanation: 'Start transaction 2.',
    },
    {
      terminal: 2,
      sql: 'SELECT * FROM accounts WHERE id = 1 FOR UPDATE NOWAIT;',
      explanation: 'Try to lock the same row with NOWAIT.',
      expectation: '❌ ERROR: could not obtain lock on row. Immediate failure, no waiting!',
    },
    {
      terminal: 2,
      sql: 'ROLLBACK;',
      explanation: 'Transaction 2 must rollback after the error.',
    },
    {
      terminal: 1,
      sql: 'COMMIT;',
      explanation: 'Transaction 1 completes normally.',
    },
  ],
  conclusion: {
    problem: 'Waiting for locks can cause timeouts and poor user experience.',
    solution:
      'NOWAIT fails immediately if the lock is unavailable. Use it when you prefer to retry or show an error rather than wait.',
  },
};

// ─────────────────────────────────────────────
// Deadlocks
// ─────────────────────────────────────────────

const deadlock: Scenario = {
  id: 'deadlock',
  title: 'Deadlock',
  description: 'Two transactions wait for each other forever',
  difficulty: 'intermediate',
  category: 'deadlocks',
  terminals: 2,
  setup: {
    isolationLevels: ['READ COMMITTED', 'READ COMMITTED'],
  },
  steps: [
    {
      terminal: 1,
      sql: 'BEGIN;',
      explanation: 'Start transaction 1.',
    },
    {
      terminal: 1,
      sql: 'UPDATE accounts SET balance = balance + 100 WHERE id = 1;',
      explanation: 'Terminal 1 locks row 1.',
    },
    {
      terminal: 2,
      sql: 'BEGIN;',
      explanation: 'Start transaction 2.',
    },
    {
      terminal: 2,
      sql: 'UPDATE accounts SET balance = balance + 200 WHERE id = 2;',
      explanation: 'Terminal 2 locks row 2. Now each terminal holds one lock.',
    },
    {
      terminal: 1,
      sql: 'UPDATE accounts SET balance = balance + 100 WHERE id = 2;',
      explanation: 'Terminal 1 tries to lock row 2.',
      expectation: '⏳ Terminal 1 waits — row 2 is locked by Terminal 2.',
    },
    {
      terminal: 2,
      sql: 'UPDATE accounts SET balance = balance + 200 WHERE id = 1;',
      explanation: 'Terminal 2 tries to lock row 1.',
      expectation: '💀 DEADLOCK! PostgreSQL detects the cycle and kills one transaction.',
    },
  ],
  conclusion: {
    problem:
      'Deadlock occurs when transactions wait for each other in a cycle. PostgreSQL detects this and aborts one transaction.',
    solution:
      'Always acquire locks in the same order (e.g., by id). Use lock timeouts. Keep transactions short.',
  },
};

const chainDeadlock: Scenario = {
  id: 'chain-deadlock',
  title: 'Chain Deadlock (3-way)',
  description: 'Three transactions in a circular wait: A→B→C→A',
  difficulty: 'advanced',
  category: 'deadlocks',
  terminals: 3,
  setup: {
    isolationLevels: ['READ COMMITTED', 'READ COMMITTED', 'READ COMMITTED'],
  },
  steps: [
    {
      terminal: 1,
      sql: 'BEGIN;',
      explanation: 'Start transaction A.',
    },
    {
      terminal: 1,
      sql: 'UPDATE accounts SET balance = balance + 1 WHERE id = 1;',
      explanation: 'A locks row 1.',
    },
    {
      terminal: 2,
      sql: 'BEGIN;',
      explanation: 'Start transaction B.',
    },
    {
      terminal: 2,
      sql: 'UPDATE accounts SET balance = balance + 1 WHERE id = 2;',
      explanation: 'B locks row 2.',
    },
    {
      terminal: 3,
      sql: 'BEGIN;',
      explanation: 'Start transaction C.',
    },
    {
      terminal: 3,
      sql: 'UPDATE products SET stock = stock + 1 WHERE id = 1;',
      explanation: 'C locks products row 1.',
    },
    {
      terminal: 1,
      sql: 'UPDATE accounts SET balance = balance + 1 WHERE id = 2;',
      explanation: 'A wants row 2 (held by B).',
      expectation: '⏳ A waits for B.',
    },
    {
      terminal: 2,
      sql: 'UPDATE products SET stock = stock + 1 WHERE id = 1;',
      explanation: 'B wants products row 1 (held by C).',
      expectation: '⏳ B waits for C.',
    },
    {
      terminal: 3,
      sql: 'UPDATE accounts SET balance = balance + 1 WHERE id = 1;',
      explanation: 'C wants accounts row 1 (held by A).',
      expectation: '💀 DEADLOCK! A→B→C→A cycle detected. One transaction aborted.',
    },
  ],
  conclusion: {
    problem: 'Deadlocks can involve more than 2 transactions. The cycle can span multiple tables.',
    solution:
      'Establish a global lock ordering across all tables. In complex systems, consider using advisory locks or application-level locking.',
  },
};

const lockQueue: Scenario = {
  id: 'lock-queue',
  title: 'Lock Queue — FIFO Ordering',
  description: 'Locks are granted in request order',
  difficulty: 'advanced',
  category: 'deadlocks',
  terminals: 3,
  setup: {
    isolationLevels: ['READ COMMITTED', 'READ COMMITTED', 'READ COMMITTED'],
  },
  steps: [
    {
      terminal: 1,
      sql: 'BEGIN;',
      explanation: 'Start transaction 1.',
    },
    {
      terminal: 1,
      sql: 'UPDATE accounts SET balance = balance + 100 WHERE id = 1;',
      explanation: 'Terminal 1 locks row 1 and holds it.',
    },
    {
      terminal: 2,
      sql: 'UPDATE accounts SET balance = balance + 200 WHERE id = 1;',
      explanation: 'Terminal 2 requests lock on row 1.',
      expectation: '⏳ Terminal 2 enters the lock queue (position 1).',
    },
    {
      terminal: 3,
      sql: 'UPDATE accounts SET balance = balance + 300 WHERE id = 1;',
      explanation: 'Terminal 3 also requests lock on row 1.',
      expectation: '⏳ Terminal 3 enters the lock queue (position 2).',
    },
    {
      terminal: 1,
      sql: 'COMMIT;',
      explanation: 'Terminal 1 releases the lock.',
      expectation: '✅ Terminal 2 gets the lock first (FIFO), Terminal 3 still waits.',
    },
    {
      terminal: 2,
      sql: '',
      explanation: 'Terminal 2 completes its UPDATE (autocommit).',
      expectation: '✅ Now Terminal 3 gets the lock and completes.',
    },
  ],
  conclusion: {
    problem: 'When multiple transactions want the same lock, they queue up.',
    solution:
      'PostgreSQL grants locks in FIFO order. Long-running transactions holding locks can create long queues — keep transactions short!',
  },
};

// ... продолжение файла ...

// ─────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────

export const SCENARIOS: Scenario[] = [
  // Read Anomalies (basic)
  dirtyRead,
  nonRepeatableRead,
  phantomRead,
  repeatableReadProtection,

  // Write Anomalies (intermediate/advanced)
  lostUpdate,
  lostUpdatePrevention,
  writeSkew,
  serializableProtection,

  // Locks (basic/intermediate)
  lockWait,
  forShareLock,
  skipLocked,
  nowait,

  // Deadlocks (intermediate/advanced)
  deadlock,
  chainDeadlock,
  lockQueue,
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

export const SCENARIOS_BY_CATEGORY = {
  'read-anomalies': SCENARIOS.filter((s) => s.category === 'read-anomalies'),
  'write-anomalies': SCENARIOS.filter((s) => s.category === 'write-anomalies'),
  locks: SCENARIOS.filter((s) => s.category === 'locks'),
  deadlocks: SCENARIOS.filter((s) => s.category === 'deadlocks'),
} as const;

export const CATEGORY_LABELS: Record<Scenario['category'], string> = {
  'read-anomalies': 'Read Anomalies',
  'write-anomalies': 'Write Anomalies',
  locks: 'Locking Patterns',
  deadlocks: 'Deadlocks',
};
