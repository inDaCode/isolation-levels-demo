import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionStore } from './session-store';
import {
  WS_EVENTS,
  type SessionState,
  type QueryResult,
  type TerminalId,
  type UncommittedSnapshot,
} from '@isolation-demo/shared';

// ─────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────

vi.mock('@/lib/socket-client', () => ({
  socket: {
    emitWithAck: vi.fn(),
  },
}));

import { socket } from '@/lib/socket-client';

const mockEmit = vi.mocked(socket.emitWithAck);

// ─────────────────────────────────────────────
// Factories
// ─────────────────────────────────────────────

function createSessionState(overrides: Partial<SessionState> = {}): SessionState {
  return {
    sessionId: 'test-session-id',
    isolationLevel: 'READ COMMITTED',
    inTransaction: false,
    createdAt: new Date(),
    ...overrides,
  };
}

function createQueryResult(overrides: Partial<QueryResult> = {}): QueryResult {
  return {
    rows: [],
    rowCount: 0,
    fields: [],
    duration: 5,
    ...overrides,
  };
}

function createUncommittedSnapshot(
  terminalId: TerminalId,
  overrides: Partial<Omit<UncommittedSnapshot, 'terminalId'>> = {},
): UncommittedSnapshot {
  return {
    terminalId,
    tables: { accounts: [], products: [] },
    modifiedRows: { accounts: [], products: [] },
    ...overrides,
  };
}

function createFreshSession() {
  return {
    state: null,
    sql: 'SELECT * FROM accounts;',
    lastResult: null,
    lastError: null,
    lastWasTransactionCommand: false,
    log: [],
    isLoading: false,
  };
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function resetStore() {
  useSessionStore.setState({
    sessions: {
      1: createFreshSession(),
      2: createFreshSession(),
      3: createFreshSession(),
    },
    uncommitted: { 1: null, 2: null, 3: null },
  });
}

function getSession(id: TerminalId) {
  return useSessionStore.getState().sessions[id];
}

function getUncommitted(id: TerminalId) {
  return useSessionStore.getState().uncommitted[id];
}

function setupWithSession(id: TerminalId, stateOverrides: Partial<SessionState> = {}) {
  const sessions = useSessionStore.getState().sessions;
  useSessionStore.setState({
    sessions: {
      ...sessions,
      [id]: { ...createFreshSession(), state: createSessionState(stateOverrides) },
    },
  });
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('useSessionStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  describe('initial state', () => {
    it('has 3 terminals with default values', () => {
      const { sessions, uncommitted } = useSessionStore.getState();

      expect(Object.keys(sessions)).toHaveLength(3);
      for (const id of [1, 2, 3] as TerminalId[]) {
        expect(sessions[id].state).toBeNull();
        expect(sessions[id].sql).toBe('SELECT * FROM accounts;');
        expect(sessions[id].log).toEqual([]);
        expect(uncommitted[id]).toBeNull();
      }
    });
  });

  describe('setSql', () => {
    it('updates sql for specified terminal only', () => {
      useSessionStore.getState().setSql(1, 'SELECT 1;');

      expect(getSession(1).sql).toBe('SELECT 1;');
      expect(getSession(2).sql).toBe('SELECT * FROM accounts;');
    });
  });

  describe('createSession', () => {
    it('creates session with terminalId and isolation level', async () => {
      const state = createSessionState({ isolationLevel: 'SERIALIZABLE' });
      mockEmit.mockResolvedValueOnce({ sessionId: state.sessionId, state });

      await useSessionStore.getState().createSession(1, 'SERIALIZABLE');

      expect(mockEmit).toHaveBeenCalledWith(WS_EVENTS.SESSION_CREATE, {
        terminalId: 1,
        isolationLevel: 'SERIALIZABLE',
      });
      expect(getSession(1).state).toEqual(state);
      expect(getSession(1).log[0].message).toBe('Session created');
    });

    it('logs error on failure', async () => {
      mockEmit.mockRejectedValueOnce(new Error('Connection failed'));

      await useSessionStore.getState().createSession(1);

      expect(getSession(1).state).toBeNull();
      expect(getSession(1).log[0].type).toBe('error');
    });
  });

  describe('execute', () => {
    beforeEach(() => setupWithSession(1));

    it('skips execution without session or empty sql', async () => {
      resetStore();
      await useSessionStore.getState().execute(1);

      setupWithSession(1);
      useSessionStore.getState().setSql(1, '   ');
      await useSessionStore.getState().execute(1);

      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('executes query and stores result', async () => {
      const result = createQueryResult({ rowCount: 3 });
      mockEmit.mockResolvedValueOnce({ sessionId: 'test-session-id', result });

      await useSessionStore.getState().execute(1);

      expect(getSession(1).lastResult).toEqual(result);
      expect(getSession(1).log[0].message).toContain('3 rows');
    });

    it('handles BEGIN with isolation level in log', async () => {
      const state = createSessionState({ isolationLevel: 'SERIALIZABLE', inTransaction: true });
      mockEmit.mockResolvedValueOnce({
        sessionId: 'test-session-id',
        result: createQueryResult(),
        state,
      });
      useSessionStore.getState().setSql(1, 'BEGIN');

      await useSessionStore.getState().execute(1);

      expect(getSession(1).log[0].message).toBe('BEGIN (SERIALIZABLE)');
      expect(getSession(1).log[0].type).toBe('success');
    });

    it('handles COMMIT', async () => {
      mockEmit.mockResolvedValueOnce({
        sessionId: 'test-session-id',
        result: createQueryResult(),
      });
      useSessionStore.getState().setSql(1, 'COMMIT');

      await useSessionStore.getState().execute(1);

      expect(getSession(1).log[0].message).toBe('COMMIT ✓');
    });

    it('handles ROLLBACK', async () => {
      mockEmit.mockResolvedValueOnce({
        sessionId: 'test-session-id',
        result: createQueryResult(),
      });
      useSessionStore.getState().setSql(1, 'ROLLBACK');

      await useSessionStore.getState().execute(1);

      expect(getSession(1).log[0].message).toBe('ROLLBACK');
      expect(getSession(1).log[0].type).toBe('warning');
    });

    it('stores error and clears result on error response', async () => {
      useSessionStore.setState({
        sessions: {
          ...useSessionStore.getState().sessions,
          1: { ...getSession(1), lastResult: createQueryResult() },
        },
      });
      mockEmit.mockResolvedValueOnce({
        sessionId: 'test-session-id',
        error: { message: 'Syntax error' },
      });

      await useSessionStore.getState().execute(1);

      expect(getSession(1).lastError).toEqual({ message: 'Syntax error' });
      expect(getSession(1).lastResult).toBeNull();
      expect(getSession(1).log[0].type).toBe('error');
    });

    it('stores uncommitted snapshot when in transaction', async () => {
      const uncommitted = createUncommittedSnapshot(1, {
        tables: { accounts: [{ id: 1 }], products: [] },
        modifiedRows: { accounts: ['1'], products: [] },
      });
      mockEmit.mockResolvedValueOnce({
        sessionId: 'test-session-id',
        result: createQueryResult(),
        state: createSessionState({ inTransaction: true }),
        uncommitted,
      });

      await useSessionStore.getState().execute(1);

      expect(getUncommitted(1)).toEqual(uncommitted);
    });

    it('clears uncommitted when transaction ends', async () => {
      useSessionStore.setState({
        uncommitted: {
          1: createUncommittedSnapshot(1),
          2: null,
          3: null,
        },
      });
      mockEmit.mockResolvedValueOnce({
        sessionId: 'test-session-id',
        result: createQueryResult(),
        state: createSessionState({ inTransaction: false }),
      });

      await useSessionStore.getState().execute(1);

      expect(getUncommitted(1)).toBeNull();
    });
  });

  describe('executeWithSql', () => {
    beforeEach(() => setupWithSession(1));

    it('sets sql and executes', async () => {
      mockEmit.mockResolvedValueOnce({
        sessionId: 'test-session-id',
        result: createQueryResult(),
      });

      await useSessionStore.getState().executeWithSql(1, 'SELECT 1;');

      expect(getSession(1).sql).toBe('SELECT 1;');
      expect(mockEmit).toHaveBeenCalledWith(WS_EVENTS.SESSION_EXECUTE, {
        sessionId: 'test-session-id',
        sql: 'SELECT 1;',
      });
    });
  });

  describe('commit', () => {
    beforeEach(() => setupWithSession(1, { inTransaction: true }));

    it('commits and clears uncommitted', async () => {
      useSessionStore.setState({
        uncommitted: {
          1: createUncommittedSnapshot(1),
          2: null,
          3: null,
        },
      });
      mockEmit.mockResolvedValueOnce({
        sessionId: 'test-session-id',
        state: createSessionState({ inTransaction: false }),
      });

      await useSessionStore.getState().commit(1);

      expect(getSession(1).state?.inTransaction).toBe(false);
      expect(getSession(1).log[0].message).toBe('COMMIT ✓');
      expect(getUncommitted(1)).toBeNull();
    });

    it('handles error', async () => {
      mockEmit.mockResolvedValueOnce({
        sessionId: 'test-session-id',
        error: 'Commit failed',
      });

      await useSessionStore.getState().commit(1);

      expect(getSession(1).lastError).toEqual({ message: 'Commit failed' });
    });

    it('skips without session state', async () => {
      resetStore();
      await useSessionStore.getState().commit(1);
      expect(mockEmit).not.toHaveBeenCalled();
    });
  });

  describe('rollback', () => {
    beforeEach(() => setupWithSession(1, { inTransaction: true }));

    it('rollbacks and clears uncommitted', async () => {
      useSessionStore.setState({
        uncommitted: {
          1: createUncommittedSnapshot(1),
          2: null,
          3: null,
        },
      });
      mockEmit.mockResolvedValueOnce({
        sessionId: 'test-session-id',
        state: createSessionState({ inTransaction: false }),
      });

      await useSessionStore.getState().rollback(1);

      expect(getSession(1).state?.inTransaction).toBe(false);
      expect(getSession(1).log[0].message).toBe('ROLLBACK');
      expect(getSession(1).log[0].type).toBe('warning');
      expect(getUncommitted(1)).toBeNull();
    });

    it('handles error', async () => {
      mockEmit.mockResolvedValueOnce({
        sessionId: 'test-session-id',
        error: 'Rollback failed',
      });

      await useSessionStore.getState().rollback(1);

      expect(getSession(1).lastError).toEqual({ message: 'Rollback failed' });
    });
  });

  describe('setIsolationLevel', () => {
    beforeEach(() => setupWithSession(1));

    it('updates isolation level', async () => {
      const state = createSessionState({ isolationLevel: 'SERIALIZABLE' });
      mockEmit.mockResolvedValueOnce({ sessionId: 'test-session-id', state });

      await useSessionStore.getState().setIsolationLevel(1, 'SERIALIZABLE');

      expect(getSession(1).state?.isolationLevel).toBe('SERIALIZABLE');
      expect(getSession(1).log[0].message).toBe('Isolation → SERIALIZABLE');
    });

    it('handles error', async () => {
      mockEmit.mockResolvedValueOnce({
        sessionId: 'test-session-id',
        error: 'Cannot change',
      });

      await useSessionStore.getState().setIsolationLevel(1, 'SERIALIZABLE');

      expect(getSession(1).lastError).toEqual({ message: 'Cannot change' });
    });
  });

  describe('clearUncommitted', () => {
    it('clears uncommitted for specified terminal only', () => {
      useSessionStore.setState({
        uncommitted: {
          1: createUncommittedSnapshot(1, {
            tables: { accounts: [{ id: 1 }], products: [] },
          }),
          2: createUncommittedSnapshot(2, {
            tables: { accounts: [{ id: 2 }], products: [] },
          }),
          3: null,
        },
      });

      useSessionStore.getState().clearUncommitted(1);

      expect(getUncommitted(1)).toBeNull();
      expect(getUncommitted(2)).not.toBeNull();
    });
  });

  describe('log management', () => {
    beforeEach(() => setupWithSession(1));

    it('caps log at 10 entries', async () => {
      mockEmit.mockResolvedValue({
        sessionId: 'test-session-id',
        result: createQueryResult(),
      });

      for (let i = 0; i < 15; i++) {
        await useSessionStore.getState().execute(1);
      }

      expect(getSession(1).log).toHaveLength(10);
    });
  });
});
