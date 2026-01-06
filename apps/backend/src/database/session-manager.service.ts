import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Client, DatabaseError } from 'pg';
import type {
  IsolationLevel,
  SessionState,
  QueryResult,
  QueryError,
  FieldInfo,
  UncommittedSnapshot,
} from '@isolation-demo/shared';
import {
  type TerminalId,
  type ActiveSession,
  type TransactionCommand,
  type OperationResult,
  type QueryExecutionResult,
  type AllowedTable,
  ALLOWED_TABLES,
  PG_TYPE_MAP,
} from './session-manager.types';

@Injectable()
export class SessionManagerService implements OnModuleDestroy {
  private readonly logger = new Logger(SessionManagerService.name);
  private readonly sessions = new Map<string, ActiveSession>();
  private utilityClient: Client | null = null;

  private readonly connectionConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'isolation_demo',
    user: process.env.DB_USER || 'demo',
    password: process.env.DB_PASSWORD || 'demo',
  };

  // ─────────────────────────────────────────────
  // Session Lifecycle
  // ─────────────────────────────────────────────

  async createSession(
    terminalId: TerminalId,
    isolationLevel: IsolationLevel = 'READ COMMITTED',
  ): Promise<SessionState> {
    const sessionId = this.generateSessionId();
    const client = new Client(this.connectionConfig);

    await client.connect();
    this.logger.log(`Session created: ${sessionId} (terminal ${terminalId})`);

    const state: SessionState = {
      sessionId,
      inTransaction: false,
      isolationLevel,
      createdAt: new Date(),
    };

    this.sessions.set(sessionId, {
      client,
      state,
      terminalId,
      modifiedRows: { accounts: new Set(), products: new Set() },
    });
    return state;
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      if (session.state.inTransaction) {
        await session.client.query('ROLLBACK');
      }
      await session.client.end();
    } catch {
      // Ignore close errors
    } finally {
      this.sessions.delete(sessionId);
      this.logger.log(`Session closed: ${sessionId}`);
    }
  }

  getSessionState(sessionId: string): SessionState | null {
    return this.sessions.get(sessionId)?.state ?? null;
  }

  // ─────────────────────────────────────────────
  // Query Execution
  // ─────────────────────────────────────────────

  async executeQuery(
    sessionId: string,
    sql: string,
  ): Promise<QueryExecutionResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { error: { message: 'Session not found' } };
    }

    const startTime = performance.now();
    const command = this.parseTransactionCommand(sql);

    if (command) {
      const result = await this.executeTransactionCommand(
        session,
        command,
        startTime,
      );

      if (!result.error && command === 'BEGIN') {
        result.uncommitted = await this.getSessionSnapshot(session);
      }

      return result;
    }

    return this.executeRegularQuery(session, sql, startTime);
  }

  private parseTransactionCommand(sql: string): TransactionCommand | null {
    const normalized = sql.trim().toUpperCase().replace(/;$/, '');

    if (normalized === 'BEGIN' || normalized.startsWith('BEGIN ')) {
      return 'BEGIN';
    }
    if (normalized === 'COMMIT') return 'COMMIT';
    if (normalized === 'ROLLBACK') return 'ROLLBACK';

    return null;
  }

  private async executeTransactionCommand(
    session: ActiveSession,
    command: TransactionCommand,
    startTime: number,
  ): Promise<QueryExecutionResult> {
    const { client, state } = session;

    if (command === 'BEGIN') {
      if (state.inTransaction) {
        return { error: { message: 'Transaction already in progress' } };
      }
      await client.query(`BEGIN ISOLATION LEVEL ${state.isolationLevel}`);
      state.inTransaction = true;
      // Clear modified rows on new transaction
      session.modifiedRows = { accounts: new Set(), products: new Set() };
    } else {
      if (!state.inTransaction) {
        return { error: { message: 'No transaction in progress' } };
      }
      await client.query(command);
      state.inTransaction = false;
      // Clear modified rows on commit/rollback
      session.modifiedRows = { accounts: new Set(), products: new Set() };
    }

    return { result: this.emptyResult(startTime) };
  }

  private async executeRegularQuery(
    session: ActiveSession,
    sql: string,
    startTime: number,
  ): Promise<QueryExecutionResult> {
    const { client, state } = session;

    try {
      // Snapshot before query (only if in transaction)
      const snapshotBefore = state.inTransaction
        ? await this.getRawSnapshot(client)
        : null;

      const pgResult = await client.query(sql);

      // Snapshot after query (only if in transaction)
      if (state.inTransaction && snapshotBefore) {
        const snapshotAfter = await this.getRawSnapshot(client);
        this.trackModifiedRows(session, snapshotBefore, snapshotAfter);
      }

      const duration = Math.round(performance.now() - startTime);

      const fields: FieldInfo[] = (pgResult.fields ?? []).map((f) => ({
        name: f.name,
        dataType: PG_TYPE_MAP[f.dataTypeID] ?? 'unknown',
      }));

      const result: QueryResult = {
        rows: pgResult.rows as Record<string, unknown>[],
        rowCount: pgResult.rowCount ?? 0,
        fields,
        duration,
      };

      let uncommitted: UncommittedSnapshot | undefined;
      if (state.inTransaction) {
        uncommitted = await this.getSessionSnapshot(session);
      }

      return { result, uncommitted };
    } catch (err) {
      if (state.inTransaction) {
        await this.silentRollback(client);
        state.inTransaction = false;
        session.modifiedRows = { accounts: new Set(), products: new Set() };
      }
      return { error: this.parseError(err) };
    }
  }

  private async getRawSnapshot(
    client: Client,
  ): Promise<{
    accounts: Record<string, unknown>[];
    products: Record<string, unknown>[];
  }> {
    const [accountsResult, productsResult] = await Promise.all([
      client.query('SELECT * FROM accounts ORDER BY id'),
      client.query('SELECT * FROM products ORDER BY id'),
    ]);

    return {
      accounts: accountsResult.rows as Record<string, unknown>[],
      products: productsResult.rows as Record<string, unknown>[],
    };
  }

  private trackModifiedRows(
    session: ActiveSession,
    before: {
      accounts: Record<string, unknown>[];
      products: Record<string, unknown>[];
    },
    after: {
      accounts: Record<string, unknown>[];
      products: Record<string, unknown>[];
    },
  ): void {
    for (const table of ALLOWED_TABLES) {
      const beforeMap = new Map(
        before[table].map((row) => [String(row.id), row]),
      );
      const afterMap = new Map(
        after[table].map((row) => [String(row.id), row]),
      );

      // Check for modified or deleted rows
      for (const [id, beforeRow] of beforeMap) {
        const afterRow = afterMap.get(id);
        if (!afterRow) {
          // Row deleted
          session.modifiedRows[table].add(id);
        } else if (JSON.stringify(beforeRow) !== JSON.stringify(afterRow)) {
          // Row modified
          session.modifiedRows[table].add(id);
        }
      }

      // Check for inserted rows
      for (const id of afterMap.keys()) {
        if (!beforeMap.has(id)) {
          session.modifiedRows[table].add(id);
        }
      }
    }
  }

  private async getSessionSnapshot(
    session: ActiveSession,
  ): Promise<UncommittedSnapshot> {
    const { client, terminalId, modifiedRows } = session;

    const [accountsResult, productsResult] = await Promise.all([
      client.query('SELECT * FROM accounts ORDER BY id'),
      client.query('SELECT * FROM products ORDER BY id'),
    ]);

    return {
      terminalId,
      tables: {
        accounts: accountsResult.rows as Record<string, unknown>[],
        products: productsResult.rows as Record<string, unknown>[],
      },
      modifiedRows: {
        accounts: Array.from(modifiedRows.accounts),
        products: Array.from(modifiedRows.products),
      },
    };
  }

  // ─────────────────────────────────────────────
  // Transaction Controls
  // ─────────────────────────────────────────────

  async commit(sessionId: string): Promise<OperationResult> {
    return this.endTransaction(sessionId, 'COMMIT');
  }

  async rollback(sessionId: string): Promise<OperationResult> {
    return this.endTransaction(sessionId, 'ROLLBACK');
  }

  private async endTransaction(
    sessionId: string,
    command: 'COMMIT' | 'ROLLBACK',
  ): Promise<OperationResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: { message: 'Session not found' } };
    }

    if (!session.state.inTransaction) {
      return { success: false, error: { message: 'No active transaction' } };
    }

    try {
      await session.client.query(command);
      session.state.inTransaction = false;
      session.modifiedRows = { accounts: new Set(), products: new Set() };
      return { success: true };
    } catch (err) {
      return { success: false, error: this.parseError(err) };
    }
  }

  setIsolationLevel(sessionId: string, level: IsolationLevel): OperationResult {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: { message: 'Session not found' } };
    }

    if (session.state.inTransaction) {
      return {
        success: false,
        error: {
          message: 'Cannot change isolation level during active transaction',
        },
      };
    }

    session.state.isolationLevel = level;
    return { success: true };
  }

  // ─────────────────────────────────────────────
  // Data Operations
  // ─────────────────────────────────────────────

  async getCommittedData(table: string): Promise<Record<string, unknown>[]> {
    if (!this.isAllowedTable(table)) {
      return [];
    }

    try {
      const client = await this.getUtilityClient();
      const result = await client.query(`SELECT * FROM ${table} ORDER BY id`);
      return result.rows as Record<string, unknown>[];
    } catch {
      return [];
    }
  }

  async executeSetup(sql: string): Promise<OperationResult> {
    try {
      const client = await this.getUtilityClient();
      await client.query(sql);
      return { success: true };
    } catch (err) {
      return { success: false, error: this.parseError(err) };
    }
  }

  private isAllowedTable(table: string): table is AllowedTable {
    return ALLOWED_TABLES.includes(table as AllowedTable);
  }

  private async getUtilityClient(): Promise<Client> {
    if (!this.utilityClient) {
      this.utilityClient = new Client(this.connectionConfig);
      await this.utilityClient.connect();
    }
    return this.utilityClient;
  }

  // ─────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────

  async onModuleDestroy(): Promise<void> {
    const closePromises = [...this.sessions.keys()].map((id) =>
      this.closeSession(id),
    );
    await Promise.allSettled(closePromises);

    if (this.utilityClient) {
      await this.utilityClient.end().catch(() => {});
    }
  }

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────

  private emptyResult(startTime: number): QueryResult {
    return {
      rows: [],
      rowCount: 0,
      fields: [],
      duration: Math.round(performance.now() - startTime),
    };
  }

  private async silentRollback(client: Client): Promise<void> {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback errors
    }
  }

  private parseError(err: unknown): QueryError {
    if (err instanceof DatabaseError) {
      return {
        message: err.message,
        code: err.code,
        detail: err.detail,
      };
    }
    if (err instanceof Error) {
      return { message: err.message };
    }
    return { message: 'Unknown error' };
  }

  private generateSessionId(): string {
    return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
}
