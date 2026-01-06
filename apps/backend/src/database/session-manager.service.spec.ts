import { SessionManagerService } from './session-manager.service';
import { SETUP_SQL } from './setup.sql';

describe('SessionManagerService', () => {
  let service: SessionManagerService;

  beforeEach(async () => {
    service = new SessionManagerService();
    await service.executeSetup(SETUP_SQL);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  describe('createSession', () => {
    it('returns valid session state with generated id', async () => {
      const state = await service.createSession(1);

      expect(state.sessionId).toMatch(/^sess_[a-z0-9]+_[a-z0-9]+$/);
    });

    it('sets inTransaction to false', async () => {
      const state = await service.createSession(1);

      expect(state.inTransaction).toBe(false);
    });

    it('uses READ COMMITTED as default isolation level', async () => {
      const state = await service.createSession(1);

      expect(state.isolationLevel).toBe('READ COMMITTED');
    });

    it('respects custom isolation level parameter', async () => {
      const state = await service.createSession(1, 'SERIALIZABLE');

      expect(state.isolationLevel).toBe('SERIALIZABLE');
    });

    it('sets createdAt to current time', async () => {
      const before = new Date();
      const state = await service.createSession(1);
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
      const state = await service.createSession(1);
      sessionId = state.sessionId;
    });

    describe('SELECT', () => {
      it('returns rows array', async () => {
        const { result } = await service.executeQuery(
          sessionId,
          'SELECT * FROM accounts ORDER BY id',
        );

        expect(result?.rows).toHaveLength(3);
        expect(result?.rows[0]).toMatchObject({ name: 'Alice' });
      });

      it('returns field metadata with names and types', async () => {
        const { result } = await service.executeQuery(
          sessionId,
          'SELECT id, name, balance FROM accounts LIMIT 1',
        );

        expect(result?.fields).toContainEqual({
          name: 'id',
          dataType: 'integer',
        });
        expect(result?.fields).toContainEqual({
          name: 'name',
          dataType: 'varchar',
        });
        expect(result?.fields).toContainEqual({
          name: 'balance',
          dataType: 'integer',
        });
      });

      it('returns rowCount', async () => {
        const { result } = await service.executeQuery(
          sessionId,
          'SELECT * FROM accounts',
        );

        expect(result?.rowCount).toBe(3);
      });

      it('returns duration in milliseconds', async () => {
        const { result } = await service.executeQuery(
          sessionId,
          'SELECT * FROM accounts',
        );

        expect(typeof result?.duration).toBe('number');
        expect(result?.duration).toBeGreaterThanOrEqual(0);
      });

      it('does not return uncommitted snapshot outside transaction', async () => {
        const { uncommitted } = await service.executeQuery(
          sessionId,
          'SELECT * FROM accounts',
        );

        expect(uncommitted).toBeUndefined();
      });
    });

    describe('BEGIN', () => {
      it('sets inTransaction to true', async () => {
        await service.executeQuery(sessionId, 'BEGIN');

        const state = service.getSessionState(sessionId);
        expect(state?.inTransaction).toBe(true);
      });

      it('uses configured isolation level', async () => {
        const { sessionId: sid } = await service.createSession(
          1,
          'SERIALIZABLE',
        );
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

      it('returns uncommitted snapshot after BEGIN', async () => {
        const { uncommitted } = await service.executeQuery(sessionId, 'BEGIN');

        expect(uncommitted).toBeDefined();
        expect(uncommitted?.terminalId).toBe(1);
        expect(uncommitted?.tables.accounts).toHaveLength(3);
        expect(uncommitted?.tables.products).toHaveLength(3);
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
          "INSERT INTO accounts (name, balance) VALUES ('temp', 0)",
        );
        await service.executeQuery(sessionId, 'ROLLBACK');

        const { result } = await service.executeQuery(
          sessionId,
          'SELECT * FROM accounts',
        );
        expect(result?.rows).toHaveLength(3);
      });
    });

    describe('uncommitted snapshots', () => {
      it('returns uncommitted snapshot for queries in transaction', async () => {
        await service.executeQuery(sessionId, 'BEGIN');
        const { uncommitted } = await service.executeQuery(
          sessionId,
          'SELECT * FROM accounts',
        );

        expect(uncommitted).toBeDefined();
        expect(uncommitted?.terminalId).toBe(1);
      });

      it('reflects uncommitted changes in snapshot', async () => {
        await service.executeQuery(sessionId, 'BEGIN');
        await service.executeQuery(
          sessionId,
          'UPDATE accounts SET balance = 9999 WHERE id = 1',
        );
        const { uncommitted } = await service.executeQuery(
          sessionId,
          'SELECT 1',
        );

        const account = uncommitted?.tables.accounts.find((a) => a.id === 1);
        expect(account?.balance).toBe(9999);
      });

      it('reflects uncommitted inserts in snapshot', async () => {
        await service.executeQuery(sessionId, 'BEGIN');
        const { uncommitted } = await service.executeQuery(
          sessionId,
          "INSERT INTO accounts (name, balance) VALUES ('NewUser', 500)",
        );

        expect(uncommitted?.tables.accounts).toHaveLength(4);
      });

      it('reflects uncommitted deletes in snapshot', async () => {
        await service.executeQuery(sessionId, 'BEGIN');
        const { uncommitted } = await service.executeQuery(
          sessionId,
          'DELETE FROM accounts WHERE id = 1',
        );

        expect(uncommitted?.tables.accounts).toHaveLength(2);
      });

      it('includes correct terminalId in snapshot', async () => {
        const { sessionId: sid2 } = await service.createSession(2);
        const { sessionId: sid3 } = await service.createSession(3);

        await service.executeQuery(sid2, 'BEGIN');
        await service.executeQuery(sid3, 'BEGIN');

        const { uncommitted: u2 } = await service.executeQuery(
          sid2,
          'SELECT 1',
        );
        const { uncommitted: u3 } = await service.executeQuery(
          sid3,
          'SELECT 1',
        );

        expect(u2?.terminalId).toBe(2);
        expect(u3?.terminalId).toBe(3);
      });
    });

    describe('errors', () => {
      it('returns QueryError for syntax errors', async () => {
        const { error } = await service.executeQuery(
          sessionId,
          'SELEC * FROM accounts',
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
      const state = await service.createSession(1);
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
      const state = await service.createSession(1);
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
      const state = await service.createSession(1);
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
      const created = await service.createSession(1, 'SERIALIZABLE');
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
    it('returns rows for allowed table', async () => {
      const rows = await service.getCommittedData('accounts');

      expect(rows).toHaveLength(3);
      expect(rows[0]).toMatchObject({ name: 'Alice', balance: 1000 });
    });

    it('returns empty array for non-allowed table', async () => {
      const rows = await service.getCommittedData('some_other_table');

      expect(rows).toEqual([]);
    });

    it('returns rows ordered by id', async () => {
      const rows = await service.getCommittedData('accounts');

      expect(rows[0].id).toBeLessThan(rows[1].id as number);
    });
  });

  describe('executeSetup', () => {
    it('executes SQL successfully', async () => {
      const result = await service.executeSetup(`SELECT 1`);

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
      const { sessionId } = await service.createSession(1);
      await service.closeSession(sessionId);

      expect(service.getSessionState(sessionId)).toBeNull();
    });

    it('rolls back active transaction before closing', async () => {
      const { sessionId } = await service.createSession(1);
      await service.executeQuery(sessionId, 'BEGIN');
      await service.executeQuery(
        sessionId,
        'UPDATE accounts SET balance = 999 WHERE id = 1',
      );
      await service.closeSession(sessionId);

      const rows = await service.getCommittedData('accounts');
      expect(rows[0]).toMatchObject({ balance: 1000 });
    });

    it('handles already closed session gracefully', async () => {
      const { sessionId } = await service.createSession(1);
      await service.closeSession(sessionId);

      await expect(service.closeSession(sessionId)).resolves.toBeUndefined();
    });
  });

  describe('onModuleDestroy', () => {
    it('closes all active sessions', async () => {
      const s1 = await service.createSession(1);
      const s2 = await service.createSession(2);
      const s3 = await service.createSession(3);

      await service.onModuleDestroy();

      expect(service.getSessionState(s1.sessionId)).toBeNull();
      expect(service.getSessionState(s2.sessionId)).toBeNull();
      expect(service.getSessionState(s3.sessionId)).toBeNull();
    });
  });

  describe('isolation level behavior', () => {
    it('READ COMMITTED sees committed changes from other transactions', async () => {
      const s1 = await service.createSession(1, 'READ COMMITTED');
      const s2 = await service.createSession(2, 'READ COMMITTED');

      await service.executeQuery(s1.sessionId, 'BEGIN');
      const { result: before } = await service.executeQuery(
        s1.sessionId,
        'SELECT balance FROM accounts WHERE id = 1',
      );

      await service.executeQuery(
        s2.sessionId,
        'UPDATE accounts SET balance = 200 WHERE id = 1',
      );

      const { result: after } = await service.executeQuery(
        s1.sessionId,
        'SELECT balance FROM accounts WHERE id = 1',
      );

      expect(before?.rows[0]).toMatchObject({ balance: 1000 });
      expect(after?.rows[0]).toMatchObject({ balance: 200 });
    });

    it('REPEATABLE READ does not see committed changes from other transactions', async () => {
      const s1 = await service.createSession(1, 'REPEATABLE READ');
      const s2 = await service.createSession(2, 'READ COMMITTED');

      await service.executeQuery(s1.sessionId, 'BEGIN');
      const { result: before } = await service.executeQuery(
        s1.sessionId,
        'SELECT balance FROM accounts WHERE id = 1',
      );

      await service.executeQuery(
        s2.sessionId,
        'UPDATE accounts SET balance = 200 WHERE id = 1',
      );

      const { result: after } = await service.executeQuery(
        s1.sessionId,
        'SELECT balance FROM accounts WHERE id = 1',
      );

      expect(before?.rows[0]).toMatchObject({ balance: 1000 });
      expect(after?.rows[0]).toMatchObject({ balance: 1000 });
    });
  });
});
