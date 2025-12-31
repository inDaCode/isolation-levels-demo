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
// Data
// ─────────────────────────────────────────────

export const SCENARIOS: Scenario[] = [
  {
    id: 'non-repeatable-read',
    title: 'Non-repeatable Read',
    description: 'Same SELECT returns different data within one transaction',
    difficulty: 'basic',
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
  },

  {
    id: 'deadlock',
    title: 'Deadlock',
    description: 'Two transactions wait for each other forever',
    difficulty: 'intermediate',
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
  },
];
