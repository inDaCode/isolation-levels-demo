import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Client, DatabaseError } from 'pg';
import type {
  IsolationLevel,
  SessionState,
  QueryResult,
  QueryError,
  FieldInfo,
} from '@isolation-demo/shared';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface ActiveSession {
  client: Client;
  state: SessionState;
}

type TransactionCommand = 'BEGIN' | 'COMMIT' | 'ROLLBACK';

interface OperationResult {
  success: boolean;
  error?: QueryError;
}

interface QueryExecutionResult {
  result?: QueryResult;
  error?: QueryError;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const ALLOWED_TABLES = ['accounts', 'products'] as const;
type AllowedTable = (typeof ALLOWED_TABLES)[number];

const PG_TYPE_MAP: Record<number, string> = {
  16: 'boolean',
  23: 'integer',
  25: 'text',
  700: 'float4',
  701: 'float8',
  1043: 'varchar',
  1082: 'date',
  1114: 'timestamp',
  1184: 'timestamptz',
  1700: 'numeric',
};

// ─────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────

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
    isolationLevel: IsolationLevel = 'READ COMMITTED',
  ): Promise<SessionState> {
    const sessionId = this.generateSessionId();
    const client = new Client(this.connectionConfig);

    await client.connect();
    this.logger.log(`Session created: ${sessionId}`);

    const state: SessionState = {
      sessionId,
      inTransaction: false,
      isolationLevel,
      createdAt: new Date(),
    };

    this.sessions.set(sessionId, { client, state });
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
      return this.executeTransactionCommand(session, command, startTime);
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
    } else {
      if (!state.inTransaction) {
        return { error: { message: 'No transaction in progress' } };
      }
      await client.query(command);
      state.inTransaction = false;
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
      const pgResult = await client.query(sql);
      const duration = Math.round(performance.now() - startTime);

      const fields: FieldInfo[] = (pgResult.fields ?? []).map((f) => ({
        name: f.name,
        dataType: PG_TYPE_MAP[f.dataTypeID] ?? 'unknown',
      }));

      return {
        result: {
          rows: pgResult.rows as Record<string, unknown>[],
          rowCount: pgResult.rowCount ?? 0,
          fields,
          duration,
        },
      };
    } catch (err) {
      if (state.inTransaction) {
        await this.silentRollback(client);
        state.inTransaction = false;
      }
      return { error: this.parseError(err) };
    }
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
