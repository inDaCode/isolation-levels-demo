import { SessionManagerService } from './session-manager.service';

describe('SessionManagerService', () => {
  let service: SessionManagerService;

  beforeEach(() => {
    service = new SessionManagerService();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  describe('createSession', () => {
    it('returns valid session state with generated id', async () => {
      const state = await service.createSession();

      expect(state.sessionId).toMatch(/^sess_[a-z0-9]+_[a-z0-9]+$/);
    });

    it('sets inTransaction to false', async () => {
      const state = await service.createSession();

      expect(state.inTransaction).toBe(false);
    });

    it('uses READ COMMITTED as default isolation level', async () => {
      const state = await service.createSession();

      expect(state.isolationLevel).toBe('READ COMMITTED');
    });

    it('respects custom isolation level parameter', async () => {
      const state = await service.createSession('SERIALIZABLE');

      expect(state.isolationLevel).toBe('SERIALIZABLE');
    });

    it('sets createdAt to current time', async () => {
      const before = new Date();
      const state = await service.createSession();
      const after = new Date();

      expect(state.createdAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(state.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('executeQuery', () => {
    let sessionId: string;

    beforeEach(async () => {
      const state = await service.createSession();
      sessionId = state.sessionId;

      await service.executeSetup(`
        DROP TABLE IF EXISTS test_table;
        CREATE TABLE test_table (id SERIAL PRIMARY KEY, value TEXT);
        INSERT INTO test_table (value) VALUES ('row1'), ('row2');
      `);
    });

    describe('SELECT', () => {
      it('returns rows array', async () => {
        const { result } = await service.executeQuery(
          sessionId,
          'SELECT * FROM test_table ORDER BY id',
        );

        expect(result?.rows).toHaveLength(2);
        expect(result?.rows[0]).toMatchObject({ value: 'row1' });
        expect(result?.rows[1]).toMatchObject({ value: 'row2' });
      });

      it('returns field metadata with names and types', async () => {
        const { result } = await service.executeQuery(
          sessionId,
          'SELECT id, value FROM test_table LIMIT 1',
        );

        expect(result?.fields).toContainEqual({
          name: 'id',
          dataType: 'integer',
        });
        expect(result?.fields).toContainEqual({
          name: 'value',
          dataType: 'text',
        });
      });

      it('returns rowCount', async () => {
        const { result } = await service.executeQuery(
          sessionId,
          'SELECT * FROM test_table',
        );

        expect(result?.rowCount).toBe(2);
      });

      it('returns duration in milliseconds', async () => {
        const { result } = await service.executeQuery(
          sessionId,
          'SELECT * FROM test_table',
        );

        expect(typeof result?.duration).toBe('number');
        expect(result?.duration).toBeGreaterThanOrEqual(0);
      });
    });

    describe('BEGIN', () => {
      it('sets inTransaction to true', async () => {
        await service.executeQuery(sessionId, 'BEGIN');

        const state = service.getSessionState(sessionId);
        expect(state?.inTransaction).toBe(true);
      });

      it('uses configured isolation level', async () => {
        const { sessionId: sid } = await service.createSession('SERIALIZABLE');
        await service.executeQuery(sid, 'BEGIN');

        const { result } = await service.executeQuery(
          sid,
          'SHOW transaction_isolation',
        );

        expect(result?.rows[0]).toMatchObject({
          transaction_isolation: 'serializable',
        });
      });

      it('returns error if already in transaction', async () => {
        await service.executeQuery(sessionId, 'BEGIN');
        const { error } = await service.executeQuery(sessionId, 'BEGIN');

        expect(error?.message).toBe('Transaction already in progress');
      });

      it('handles BEGIN with semicolon', async () => {
        await service.executeQuery(sessionId, 'BEGIN;');

        const state = service.getSessionState(sessionId);
        expect(state?.inTransaction).toBe(true);
      });
    });

    describe('COMMIT', () => {
      it('sets inTransaction to false', async () => {
        await service.executeQuery(sessionId, 'BEGIN');
        await service.executeQuery(sessionId, 'COMMIT');

        const state = service.getSessionState(sessionId);
        expect(state?.inTransaction).toBe(false);
      });

      it('returns error if no transaction in progress', async () => {
        const { error } = await service.executeQuery(sessionId, 'COMMIT');

        expect(error?.message).toBe('No transaction in progress');
      });

      it('handles COMMIT with semicolon', async () => {
        await service.executeQuery(sessionId, 'BEGIN');
        const { error } = await service.executeQuery(sessionId, 'COMMIT;');

        expect(error).toBeUndefined();
        expect(service.getSessionState(sessionId)?.inTransaction).toBe(false);
      });
    });

    describe('ROLLBACK', () => {
      it('sets inTransaction to false', async () => {
        await service.executeQuery(sessionId, 'BEGIN');
        await service.executeQuery(sessionId, 'ROLLBACK');

        const state = service.getSessionState(sessionId);
        expect(state?.inTransaction).toBe(false);
      });

      it('returns error if no transaction in progress', async () => {
        const { error } = await service.executeQuery(sessionId, 'ROLLBACK');

        expect(error?.message).toBe('No transaction in progress');
      });

      it('discards uncommitted changes', async () => {
        await service.executeQuery(sessionId, 'BEGIN');
        await service.executeQuery(
          sessionId,
          "INSERT INTO test_table (value) VALUES ('new')",
        );
        await service.executeQuery(sessionId, 'ROLLBACK');

        const { result } = await service.executeQuery(
          sessionId,
          'SELECT * FROM test_table',
        );
        expect(result?.rows).toHaveLength(2);
      });
    });

    describe('errors', () => {
      it('returns QueryError for syntax errors', async () => {
        const { error } = await service.executeQuery(
          sessionId,
          'SELEC * FROM test_table',
        );

        expect(error).toBeDefined();
        expect(error?.message.toLowerCase()).toContain('syntax');
      });

      it('returns error code for PG errors', async () => {
        const { error } = await service.executeQuery(
          sessionId,
          'SELECT * FROM nonexistent_table',
        );

        expect(error?.code).toBeDefined();
      });

      it('auto-rollbacks transaction on error', async () => {
        await service.executeQuery(sessionId, 'BEGIN');
        await service.executeQuery(sessionId, 'SELECT * FROM nonexistent');

        const state = service.getSessionState(sessionId);
        expect(state?.inTransaction).toBe(false);
      });

      it('returns error for unknown session', async () => {
        const { error } = await service.executeQuery(
          'unknown_session',
          'SELECT 1',
        );

        expect(error?.message).toBe('Session not found');
      });
    });
  });

  describe('commit', () => {
    let sessionId: string;

    beforeEach(async () => {
      const state = await service.createSession();
      sessionId = state.sessionId;
    });

    it('commits active transaction', async () => {
      await service.executeQuery(sessionId, 'BEGIN');
      const result = await service.commit(sessionId);

      expect(result.success).toBe(true);
      expect(service.getSessionState(sessionId)?.inTransaction).toBe(false);
    });

    it('returns error if no active transaction', async () => {
      const result = await service.commit(sessionId);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('No active transaction');
    });

    it('returns error for unknown session', async () => {
      const result = await service.commit('unknown_session');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Session not found');
    });
  });

  describe('rollback', () => {
    let sessionId: string;

    beforeEach(async () => {
      const state = await service.createSession();
      sessionId = state.sessionId;
    });

    it('rolls back active transaction', async () => {
      await service.executeQuery(sessionId, 'BEGIN');
      const result = await service.rollback(sessionId);

      expect(result.success).toBe(true);
      expect(service.getSessionState(sessionId)?.inTransaction).toBe(false);
    });

    it('returns error if no active transaction', async () => {
      const result = await service.rollback(sessionId);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('No active transaction');
    });

    it('returns error for unknown session', async () => {
      const result = await service.rollback('unknown_session');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Session not found');
    });
  });

  describe('setIsolationLevel', () => {
    let sessionId: string;

    beforeEach(async () => {
      const state = await service.createSession();
      sessionId = state.sessionId;
    });

    it('updates isolation level outside transaction', () => {
      const result = service.setIsolationLevel(sessionId, 'SERIALIZABLE');

      expect(result.success).toBe(true);
      expect(service.getSessionState(sessionId)?.isolationLevel).toBe(
        'SERIALIZABLE',
      );
    });

    it('returns error if in active transaction', async () => {
      await service.executeQuery(sessionId, 'BEGIN');
      const result = service.setIsolationLevel(sessionId, 'SERIALIZABLE');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe(
        'Cannot change isolation level during active transaction',
      );
    });

    it('returns error for unknown session', () => {
      const result = service.setIsolationLevel(
        'unknown_session',
        'SERIALIZABLE',
      );

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Session not found');
    });

    it('applies new level on next BEGIN', async () => {
      service.setIsolationLevel(sessionId, 'REPEATABLE READ');
      await service.executeQuery(sessionId, 'BEGIN');

      const { result } = await service.executeQuery(
        sessionId,
        'SHOW transaction_isolation',
      );

      expect(result?.rows[0]).toMatchObject({
        transaction_isolation: 'repeatable read',
      });
    });
  });

  describe('getSessionState', () => {
    it('returns state for existing session', async () => {
      const created = await service.createSession('SERIALIZABLE');
      const state = service.getSessionState(created.sessionId);

      expect(state).toMatchObject({
        sessionId: created.sessionId,
        isolationLevel: 'SERIALIZABLE',
        inTransaction: false,
      });
    });

    it('returns null for unknown session', () => {
      const state = service.getSessionState('unknown_session');

      expect(state).toBeNull();
    });
  });

  describe('getCommittedData', () => {
    beforeEach(async () => {
      await service.executeSetup(`
        DROP TABLE IF EXISTS committed_test;
        CREATE TABLE committed_test (id SERIAL PRIMARY KEY, name TEXT);
        INSERT INTO committed_test (name) VALUES ('Alice'), ('Bob');
      `);
    });

    it('returns rows from specified table', async () => {
      const rows = await service.getCommittedData('committed_test');

      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({ name: 'Alice' });
      expect(rows[1]).toMatchObject({ name: 'Bob' });
    });

    it('returns empty array for non-existent table', async () => {
      const rows = await service.getCommittedData('nonexistent_table');

      expect(rows).toEqual([]);
    });
  });

  describe('executeSetup', () => {
    it('executes SQL successfully', async () => {
      const result = await service.executeSetup(`
        DROP TABLE IF EXISTS setup_test;
        CREATE TABLE setup_test (id INT);
      `);

      expect(result.success).toBe(true);
    });

    it('returns error for invalid SQL', async () => {
      const result = await service.executeSetup('INVALID SQL STATEMENT');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('closeSession', () => {
    it('removes session from map', async () => {
      const { sessionId } = await service.createSession();
      await service.closeSession(sessionId);

      expect(service.getSessionState(sessionId)).toBeNull();
    });

    it('rolls back active transaction before closing', async () => {
      await service.executeSetup(`
        DROP TABLE IF EXISTS close_test;
        CREATE TABLE close_test (id SERIAL PRIMARY KEY, value TEXT);
        INSERT INTO close_test (value) VALUES ('original');
      `);

      const { sessionId } = await service.createSession();
      await service.executeQuery(sessionId, 'BEGIN');
      await service.executeQuery(
        sessionId,
        "UPDATE close_test SET value = 'modified' WHERE id = 1",
      );
      await service.closeSession(sessionId);

      const rows = await service.getCommittedData('close_test');
      expect(rows[0]).toMatchObject({ value: 'original' });
    });

    it('handles already closed session gracefully', async () => {
      const { sessionId } = await service.createSession();
      await service.closeSession(sessionId);

      await expect(service.closeSession(sessionId)).resolves.toBeUndefined();
    });
  });

  describe('onModuleDestroy', () => {
    it('closes all active sessions', async () => {
      const s1 = await service.createSession();
      const s2 = await service.createSession();
      const s3 = await service.createSession();

      await service.onModuleDestroy();

      expect(service.getSessionState(s1.sessionId)).toBeNull();
      expect(service.getSessionState(s2.sessionId)).toBeNull();
      expect(service.getSessionState(s3.sessionId)).toBeNull();
    });
  });

  describe('isolation level behavior', () => {
    beforeEach(async () => {
      await service.executeSetup(`
        DROP TABLE IF EXISTS isolation_test;
        CREATE TABLE isolation_test (id SERIAL PRIMARY KEY, counter INT);
        INSERT INTO isolation_test (counter) VALUES (100);
      `);
    });

    it('READ COMMITTED sees committed changes from other transactions', async () => {
      const s1 = await service.createSession('READ COMMITTED');
      const s2 = await service.createSession('READ COMMITTED');

      await service.executeQuery(s1.sessionId, 'BEGIN');
      const { result: before } = await service.executeQuery(
        s1.sessionId,
        'SELECT counter FROM isolation_test WHERE id = 1',
      );

      await service.executeQuery(
        s2.sessionId,
        'UPDATE isolation_test SET counter = 200 WHERE id = 1',
      );

      const { result: after } = await service.executeQuery(
        s1.sessionId,
        'SELECT counter FROM isolation_test WHERE id = 1',
      );

      expect(before?.rows[0]).toMatchObject({ counter: 100 });
      expect(after?.rows[0]).toMatchObject({ counter: 200 });
    });

    it('REPEATABLE READ does not see committed changes from other transactions', async () => {
      const s1 = await service.createSession('REPEATABLE READ');
      const s2 = await service.createSession('READ COMMITTED');

      await service.executeQuery(s1.sessionId, 'BEGIN');
      const { result: before } = await service.executeQuery(
        s1.sessionId,
        'SELECT counter FROM isolation_test WHERE id = 1',
      );

      await service.executeQuery(
        s2.sessionId,
        'UPDATE isolation_test SET counter = 200 WHERE id = 1',
      );

      const { result: after } = await service.executeQuery(
        s1.sessionId,
        'SELECT counter FROM isolation_test WHERE id = 1',
      );

      expect(before?.rows[0]).toMatchObject({ counter: 100 });
      expect(after?.rows[0]).toMatchObject({ counter: 100 });
    });
  });
});
