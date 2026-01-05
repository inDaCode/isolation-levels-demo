import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionStore, type TerminalId } from './session-store';
import { WS_EVENTS } from '@isolation-demo/shared';

vi.mock('@/lib/socket-client', () => ({
  socket: {
    emitWithAck: vi.fn(),
  },
}));

import { socket } from '@/lib/socket-client';

const mockEmitWithAck = vi.mocked(socket.emitWithAck);

const mockSessionState = (overrides = {}) => ({
  sessionId: 'test-session-id',
  isolationLevel: 'READ COMMITTED' as const,
  inTransaction: false,
  createdAt: new Date(),
  ...overrides,
});

const mockQueryResult = (overrides = {}) => ({
  rows: [],
  rowCount: 0,
  fields: [],
  duration: 5,
  ...overrides,
});

describe('useSessionStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSessionStore.setState({
      sessions: {
        1: createFreshSession(),
        2: createFreshSession(),
        3: createFreshSession(),
      },
    });
  });

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

  function getSession(terminalId: TerminalId) {
    return useSessionStore.getState().sessions[terminalId];
  }

  describe('initial state', () => {
    it('has 3 terminal sessions', () => {
      const { sessions } = useSessionStore.getState();
      expect(Object.keys(sessions)).toHaveLength(3);
      expect(sessions[1]).toBeDefined();
      expect(sessions[2]).toBeDefined();
      expect(sessions[3]).toBeDefined();
    });

    it('each session has default SQL', () => {
      const { sessions } = useSessionStore.getState();
      expect(sessions[1].sql).toBe('SELECT * FROM accounts;');
      expect(sessions[2].sql).toBe('SELECT * FROM accounts;');
      expect(sessions[3].sql).toBe('SELECT * FROM accounts;');
    });

    it('each session has null state', () => {
      const { sessions } = useSessionStore.getState();
      expect(sessions[1].state).toBeNull();
      expect(sessions[2].state).toBeNull();
      expect(sessions[3].state).toBeNull();
    });

    it('each session has empty log', () => {
      const { sessions } = useSessionStore.getState();
      expect(sessions[1].log).toEqual([]);
      expect(sessions[2].log).toEqual([]);
      expect(sessions[3].log).toEqual([]);
    });

    it('each session has isLoading false', () => {
      const { sessions } = useSessionStore.getState();
      expect(sessions[1].isLoading).toBe(false);
      expect(sessions[2].isLoading).toBe(false);
      expect(sessions[3].isLoading).toBe(false);
    });
  });

  describe('setSql', () => {
    it('updates sql for specified terminal', () => {
      useSessionStore.getState().setSql(1, 'SELECT 1;');
      expect(getSession(1).sql).toBe('SELECT 1;');
    });

    it('does not affect other terminals', () => {
      useSessionStore.getState().setSql(1, 'SELECT 1;');
      expect(getSession(2).sql).toBe('SELECT * FROM accounts;');
      expect(getSession(3).sql).toBe('SELECT * FROM accounts;');
    });
  });

  describe('createSession', () => {
    it('sets isLoading true during request', async () => {
      let resolvePromise: (value: unknown) => void;
      mockEmitWithAck.mockImplementation(
        () => new Promise((resolve) => (resolvePromise = resolve)),
      );

      const promise = useSessionStore.getState().createSession(1);
      expect(getSession(1).isLoading).toBe(true);

      resolvePromise!({ state: mockSessionState() });
      await promise;
    });

    it('populates state on success', async () => {
      const state = mockSessionState();
      mockEmitWithAck.mockResolvedValue({ state });

      await useSessionStore.getState().createSession(1);

      expect(getSession(1).state).toEqual(state);
    });

    it('sets isLoading false on success', async () => {
      mockEmitWithAck.mockResolvedValue({ state: mockSessionState() });

      await useSessionStore.getState().createSession(1);

      expect(getSession(1).isLoading).toBe(false);
    });

    it('adds log entry on success', async () => {
      mockEmitWithAck.mockResolvedValue({ state: mockSessionState() });

      await useSessionStore.getState().createSession(1);

      expect(getSession(1).log).toHaveLength(1);
      expect(getSession(1).log[0].message).toBe('Session created');
      expect(getSession(1).log[0].type).toBe('info');
    });

    it('sets isLoading false on error', async () => {
      mockEmitWithAck.mockRejectedValue(new Error('Connection failed'));

      await useSessionStore.getState().createSession(1);

      expect(getSession(1).isLoading).toBe(false);
    });

    it('adds error to log on error', async () => {
      mockEmitWithAck.mockRejectedValue(new Error('Connection failed'));

      await useSessionStore.getState().createSession(1);

      expect(getSession(1).log).toHaveLength(1);
      expect(getSession(1).log[0].message).toBe('Connection failed');
      expect(getSession(1).log[0].type).toBe('error');
    });

    it('passes isolation level to socket', async () => {
      mockEmitWithAck.mockResolvedValue({ state: mockSessionState() });

      await useSessionStore.getState().createSession(1, 'SERIALIZABLE');

      expect(mockEmitWithAck).toHaveBeenCalledWith(WS_EVENTS.SESSION_CREATE, {
        isolationLevel: 'SERIALIZABLE',
      });
    });
  });

  describe('execute', () => {
    beforeEach(() => {
      useSessionStore.setState({
        sessions: {
          ...useSessionStore.getState().sessions,
          1: {
            ...createFreshSession(),
            state: mockSessionState(),
          },
        },
      });
    });

    it('does nothing without session state', async () => {
      useSessionStore.setState({
        sessions: {
          ...useSessionStore.getState().sessions,
          1: createFreshSession(),
        },
      });

      await useSessionStore.getState().execute(1);

      expect(mockEmitWithAck).not.toHaveBeenCalled();
    });

    it('does nothing with empty sql', async () => {
      useSessionStore.getState().setSql(1, '   ');

      await useSessionStore.getState().execute(1);

      expect(mockEmitWithAck).not.toHaveBeenCalled();
    });

    it('sets isLoading true during request', async () => {
      let resolvePromise: (value: unknown) => void;
      mockEmitWithAck.mockImplementation(
        () => new Promise((resolve) => (resolvePromise = resolve)),
      );

      const promise = useSessionStore.getState().execute(1);
      expect(getSession(1).isLoading).toBe(true);

      resolvePromise!({ result: mockQueryResult() });
      await promise;
    });

    it('sets lastWasTransactionCommand for BEGIN', async () => {
      mockEmitWithAck.mockResolvedValue({ result: mockQueryResult() });
      useSessionStore.getState().setSql(1, 'BEGIN');

      await useSessionStore.getState().execute(1);

      expect(getSession(1).lastWasTransactionCommand).toBe(true);
    });

    it('sets lastWasTransactionCommand for COMMIT', async () => {
      mockEmitWithAck.mockResolvedValue({ result: mockQueryResult() });
      useSessionStore.getState().setSql(1, 'COMMIT');

      await useSessionStore.getState().execute(1);

      expect(getSession(1).lastWasTransactionCommand).toBe(true);
    });

    it('sets lastWasTransactionCommand for ROLLBACK', async () => {
      mockEmitWithAck.mockResolvedValue({ result: mockQueryResult() });
      useSessionStore.getState().setSql(1, 'ROLLBACK');

      await useSessionStore.getState().execute(1);

      expect(getSession(1).lastWasTransactionCommand).toBe(true);
    });

    describe('success response', () => {
      it('sets lastResult', async () => {
        const result = mockQueryResult({ rowCount: 5 });
        mockEmitWithAck.mockResolvedValue({ result });

        await useSessionStore.getState().execute(1);

        expect(getSession(1).lastResult).toEqual(result);
      });

      it('updates session state', async () => {
        const newState = mockSessionState({ inTransaction: true });
        mockEmitWithAck.mockResolvedValue({
          result: mockQueryResult(),
          state: newState,
        });

        await useSessionStore.getState().execute(1);

        expect(getSession(1).state).toEqual(newState);
      });

      it('sets isLoading false', async () => {
        mockEmitWithAck.mockResolvedValue({ result: mockQueryResult() });

        await useSessionStore.getState().execute(1);

        expect(getSession(1).isLoading).toBe(false);
      });

      it('adds formatted log entry for SELECT', async () => {
        mockEmitWithAck.mockResolvedValue({
          result: mockQueryResult({ rowCount: 3, duration: 10 }),
        });
        useSessionStore.getState().setSql(1, 'SELECT * FROM accounts;');

        await useSessionStore.getState().execute(1);

        const log = getSession(1).log[0];
        expect(log.message).toContain('SELECT * FROM accounts;');
        expect(log.message).toContain('3 rows');
        expect(log.message).toContain('10ms');
        expect(log.type).toBe('info');
      });

      it('logs "BEGIN (isolation_level)" for BEGIN', async () => {
        mockEmitWithAck.mockResolvedValue({
          result: mockQueryResult(),
          state: mockSessionState({ isolationLevel: 'SERIALIZABLE' }),
        });
        useSessionStore.getState().setSql(1, 'BEGIN');

        await useSessionStore.getState().execute(1);

        expect(getSession(1).log[0].message).toBe('BEGIN (SERIALIZABLE)');
        expect(getSession(1).log[0].type).toBe('success');
      });

      it('logs "COMMIT ✓" for COMMIT', async () => {
        mockEmitWithAck.mockResolvedValue({ result: mockQueryResult() });
        useSessionStore.getState().setSql(1, 'COMMIT');

        await useSessionStore.getState().execute(1);

        expect(getSession(1).log[0].message).toBe('COMMIT ✓');
        expect(getSession(1).log[0].type).toBe('success');
      });

      it('logs "ROLLBACK" with warning type for ROLLBACK', async () => {
        mockEmitWithAck.mockResolvedValue({ result: mockQueryResult() });
        useSessionStore.getState().setSql(1, 'ROLLBACK');

        await useSessionStore.getState().execute(1);

        expect(getSession(1).log[0].message).toBe('ROLLBACK');
        expect(getSession(1).log[0].type).toBe('warning');
      });
    });

    describe('error response', () => {
      it('sets lastError', async () => {
        const error = { message: 'Syntax error' };
        mockEmitWithAck.mockResolvedValue({ error });

        await useSessionStore.getState().execute(1);

        expect(getSession(1).lastError).toEqual(error);
      });

      it('clears lastResult', async () => {
        useSessionStore.setState({
          sessions: {
            ...useSessionStore.getState().sessions,
            1: {
              ...getSession(1),
              lastResult: mockQueryResult(),
            },
          },
        });
        mockEmitWithAck.mockResolvedValue({ error: { message: 'Error' } });

        await useSessionStore.getState().execute(1);

        expect(getSession(1).lastResult).toBeNull();
      });

      it('updates session state', async () => {
        const newState = mockSessionState({ inTransaction: false });
        mockEmitWithAck.mockResolvedValue({
          error: { message: 'Error' },
          state: newState,
        });

        await useSessionStore.getState().execute(1);

        expect(getSession(1).state).toEqual(newState);
      });

      it('sets isLoading false', async () => {
        mockEmitWithAck.mockResolvedValue({ error: { message: 'Error' } });

        await useSessionStore.getState().execute(1);

        expect(getSession(1).isLoading).toBe(false);
      });

      it('adds error to log', async () => {
        mockEmitWithAck.mockResolvedValue({ error: { message: 'Syntax error' } });

        await useSessionStore.getState().execute(1);

        expect(getSession(1).log[0].message).toBe('Syntax error');
        expect(getSession(1).log[0].type).toBe('error');
      });
    });

    describe('network error', () => {
      it('sets isLoading false', async () => {
        mockEmitWithAck.mockRejectedValue(new Error('Network error'));

        await useSessionStore.getState().execute(1);

        expect(getSession(1).isLoading).toBe(false);
      });

      it('adds error to log', async () => {
        mockEmitWithAck.mockRejectedValue(new Error('Network error'));

        await useSessionStore.getState().execute(1);

        expect(getSession(1).log[0].message).toBe('Network error');
        expect(getSession(1).log[0].type).toBe('error');
      });
    });
  });

  describe('executeWithSql', () => {
    beforeEach(() => {
      useSessionStore.setState({
        sessions: {
          ...useSessionStore.getState().sessions,
          1: {
            ...createFreshSession(),
            state: mockSessionState(),
          },
        },
      });
    });

    it('sets sql then executes', async () => {
      mockEmitWithAck.mockResolvedValue({ result: mockQueryResult() });

      await useSessionStore.getState().executeWithSql(1, 'SELECT 1;');

      expect(getSession(1).sql).toBe('SELECT 1;');
    });

    it('executes with provided sql', async () => {
      mockEmitWithAck.mockResolvedValue({ result: mockQueryResult() });

      await useSessionStore.getState().executeWithSql(1, 'SELECT 1;');

      expect(mockEmitWithAck).toHaveBeenCalledWith(WS_EVENTS.SESSION_EXECUTE, {
        sessionId: 'test-session-id',
        sql: 'SELECT 1;',
      });
    });
  });

  describe('commit', () => {
    beforeEach(() => {
      useSessionStore.setState({
        sessions: {
          ...useSessionStore.getState().sessions,
          1: {
            ...createFreshSession(),
            state: mockSessionState({ inTransaction: true }),
          },
        },
      });
    });

    it('does nothing without session state', async () => {
      useSessionStore.setState({
        sessions: {
          ...useSessionStore.getState().sessions,
          1: createFreshSession(),
        },
      });

      await useSessionStore.getState().commit(1);

      expect(mockEmitWithAck).not.toHaveBeenCalled();
    });

    it('sets isLoading true during request', async () => {
      let resolvePromise: (value: unknown) => void;
      mockEmitWithAck.mockImplementation(
        () => new Promise((resolve) => (resolvePromise = resolve)),
      );

      const promise = useSessionStore.getState().commit(1);
      expect(getSession(1).isLoading).toBe(true);

      resolvePromise!({ state: mockSessionState() });
      await promise;
    });

    it('sets lastWasTransactionCommand true', async () => {
      mockEmitWithAck.mockResolvedValue({ state: mockSessionState() });

      await useSessionStore.getState().commit(1);

      expect(getSession(1).lastWasTransactionCommand).toBe(true);
    });

    describe('success', () => {
      it('updates session state', async () => {
        const newState = mockSessionState({ inTransaction: false });
        mockEmitWithAck.mockResolvedValue({ state: newState });

        await useSessionStore.getState().commit(1);

        expect(getSession(1).state).toEqual(newState);
      });

      it('clears lastResult', async () => {
        useSessionStore.setState({
          sessions: {
            ...useSessionStore.getState().sessions,
            1: {
              ...getSession(1),
              lastResult: mockQueryResult(),
            },
          },
        });
        mockEmitWithAck.mockResolvedValue({ state: mockSessionState() });

        await useSessionStore.getState().commit(1);

        expect(getSession(1).lastResult).toBeNull();
      });

      it('sets isLoading false', async () => {
        mockEmitWithAck.mockResolvedValue({ state: mockSessionState() });

        await useSessionStore.getState().commit(1);

        expect(getSession(1).isLoading).toBe(false);
      });

      it('adds "COMMIT ✓" to log', async () => {
        mockEmitWithAck.mockResolvedValue({ state: mockSessionState() });

        await useSessionStore.getState().commit(1);

        expect(getSession(1).log[0].message).toBe('COMMIT ✓');
        expect(getSession(1).log[0].type).toBe('success');
      });
    });

    describe('error', () => {
      it('sets lastError', async () => {
        mockEmitWithAck.mockResolvedValue({ error: 'Commit failed' });

        await useSessionStore.getState().commit(1);

        expect(getSession(1).lastError).toEqual({ message: 'Commit failed' });
      });

      it('sets isLoading false', async () => {
        mockEmitWithAck.mockResolvedValue({ error: 'Commit failed' });

        await useSessionStore.getState().commit(1);

        expect(getSession(1).isLoading).toBe(false);
      });

      it('adds error to log', async () => {
        mockEmitWithAck.mockResolvedValue({ error: 'Commit failed' });

        await useSessionStore.getState().commit(1);

        expect(getSession(1).log[0].message).toBe('Commit failed');
        expect(getSession(1).log[0].type).toBe('error');
      });
    });
  });

  describe('rollback', () => {
    beforeEach(() => {
      useSessionStore.setState({
        sessions: {
          ...useSessionStore.getState().sessions,
          1: {
            ...createFreshSession(),
            state: mockSessionState({ inTransaction: true }),
          },
        },
      });
    });

    it('does nothing without session state', async () => {
      useSessionStore.setState({
        sessions: {
          ...useSessionStore.getState().sessions,
          1: createFreshSession(),
        },
      });

      await useSessionStore.getState().rollback(1);

      expect(mockEmitWithAck).not.toHaveBeenCalled();
    });

    it('sets isLoading true during request', async () => {
      let resolvePromise: (value: unknown) => void;
      mockEmitWithAck.mockImplementation(
        () => new Promise((resolve) => (resolvePromise = resolve)),
      );

      const promise = useSessionStore.getState().rollback(1);
      expect(getSession(1).isLoading).toBe(true);

      resolvePromise!({ state: mockSessionState() });
      await promise;
    });

    it('sets lastWasTransactionCommand true', async () => {
      mockEmitWithAck.mockResolvedValue({ state: mockSessionState() });

      await useSessionStore.getState().rollback(1);

      expect(getSession(1).lastWasTransactionCommand).toBe(true);
    });

    describe('success', () => {
      it('updates session state', async () => {
        const newState = mockSessionState({ inTransaction: false });
        mockEmitWithAck.mockResolvedValue({ state: newState });

        await useSessionStore.getState().rollback(1);

        expect(getSession(1).state).toEqual(newState);
      });

      it('clears lastResult', async () => {
        useSessionStore.setState({
          sessions: {
            ...useSessionStore.getState().sessions,
            1: {
              ...getSession(1),
              lastResult: mockQueryResult(),
            },
          },
        });
        mockEmitWithAck.mockResolvedValue({ state: mockSessionState() });

        await useSessionStore.getState().rollback(1);

        expect(getSession(1).lastResult).toBeNull();
      });

      it('sets isLoading false', async () => {
        mockEmitWithAck.mockResolvedValue({ state: mockSessionState() });

        await useSessionStore.getState().rollback(1);

        expect(getSession(1).isLoading).toBe(false);
      });

      it('adds "ROLLBACK" to log with warning type', async () => {
        mockEmitWithAck.mockResolvedValue({ state: mockSessionState() });

        await useSessionStore.getState().rollback(1);

        expect(getSession(1).log[0].message).toBe('ROLLBACK');
        expect(getSession(1).log[0].type).toBe('warning');
      });
    });

    describe('error', () => {
      it('sets lastError', async () => {
        mockEmitWithAck.mockResolvedValue({ error: 'Rollback failed' });

        await useSessionStore.getState().rollback(1);

        expect(getSession(1).lastError).toEqual({ message: 'Rollback failed' });
      });

      it('sets isLoading false', async () => {
        mockEmitWithAck.mockResolvedValue({ error: 'Rollback failed' });

        await useSessionStore.getState().rollback(1);

        expect(getSession(1).isLoading).toBe(false);
      });

      it('adds error to log', async () => {
        mockEmitWithAck.mockResolvedValue({ error: 'Rollback failed' });

        await useSessionStore.getState().rollback(1);

        expect(getSession(1).log[0].message).toBe('Rollback failed');
        expect(getSession(1).log[0].type).toBe('error');
      });
    });
  });

  describe('setIsolationLevel', () => {
    beforeEach(() => {
      useSessionStore.setState({
        sessions: {
          ...useSessionStore.getState().sessions,
          1: {
            ...createFreshSession(),
            state: mockSessionState(),
          },
        },
      });
    });

    it('does nothing without session state', async () => {
      useSessionStore.setState({
        sessions: {
          ...useSessionStore.getState().sessions,
          1: createFreshSession(),
        },
      });

      await useSessionStore.getState().setIsolationLevel(1, 'SERIALIZABLE');

      expect(mockEmitWithAck).not.toHaveBeenCalled();
    });

    describe('success', () => {
      it('updates session state', async () => {
        const newState = mockSessionState({ isolationLevel: 'SERIALIZABLE' });
        mockEmitWithAck.mockResolvedValue({ state: newState });

        await useSessionStore.getState().setIsolationLevel(1, 'SERIALIZABLE');

        expect(getSession(1).state).toEqual(newState);
      });

      it('adds "Isolation → LEVEL" to log', async () => {
        mockEmitWithAck.mockResolvedValue({
          state: mockSessionState({ isolationLevel: 'SERIALIZABLE' }),
        });

        await useSessionStore.getState().setIsolationLevel(1, 'SERIALIZABLE');

        expect(getSession(1).log[0].message).toBe('Isolation → SERIALIZABLE');
        expect(getSession(1).log[0].type).toBe('info');
      });
    });

    describe('error', () => {
      it('sets lastError', async () => {
        mockEmitWithAck.mockResolvedValue({ error: 'Cannot change isolation' });

        await useSessionStore.getState().setIsolationLevel(1, 'SERIALIZABLE');

        expect(getSession(1).lastError).toEqual({ message: 'Cannot change isolation' });
      });

      it('adds error to log', async () => {
        mockEmitWithAck.mockResolvedValue({ error: 'Cannot change isolation' });

        await useSessionStore.getState().setIsolationLevel(1, 'SERIALIZABLE');

        expect(getSession(1).log[0].message).toBe('Cannot change isolation');
        expect(getSession(1).log[0].type).toBe('error');
      });
    });
  });

  describe('log management', () => {
    beforeEach(() => {
      useSessionStore.setState({
        sessions: {
          ...useSessionStore.getState().sessions,
          1: {
            ...createFreshSession(),
            state: mockSessionState(),
          },
        },
      });
    });

    it('caps log entries at MAX_LOG_ENTRIES (10)', async () => {
      mockEmitWithAck.mockResolvedValue({ result: mockQueryResult() });

      for (let i = 0; i < 15; i++) {
        await useSessionStore.getState().execute(1);
      }

      expect(getSession(1).log).toHaveLength(10);
    });

    it('removes oldest entries when cap exceeded', async () => {
      mockEmitWithAck.mockResolvedValue({ result: mockQueryResult() });

      for (let i = 0; i < 12; i++) {
        useSessionStore.getState().setSql(1, `SELECT ${i};`);
        await useSessionStore.getState().execute(1);
      }

      const log = getSession(1).log;
      expect(log[0].message).toContain('SELECT 2');
      expect(log[9].message).toContain('SELECT 11');
    });

    it('includes timestamp in log entries', async () => {
      mockEmitWithAck.mockResolvedValue({ result: mockQueryResult() });

      await useSessionStore.getState().execute(1);

      const log = getSession(1).log[0];
      expect(log.timestamp).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });

    it('increments log entry id', async () => {
      mockEmitWithAck.mockResolvedValue({ result: mockQueryResult() });

      await useSessionStore.getState().execute(1);
      await useSessionStore.getState().execute(1);

      const log = getSession(1).log;
      expect(log[1].id).toBeGreaterThan(log[0].id);
    });
  });
});
