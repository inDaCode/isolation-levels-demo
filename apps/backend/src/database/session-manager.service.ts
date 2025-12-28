import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Client, DatabaseError } from 'pg';
import type {
  IsolationLevel,
  SessionState,
  QueryResult,
  QueryError,
  FieldInfo,
} from '@isolation-demo/shared';

/**
 * Active PostgreSQL session
 */
interface ActiveSession {
  client: Client;
  state: SessionState;
}

/**
 * Manages PostgreSQL sessions for isolation level demonstration.
 * Each session maintains its own dedicated database connection.
 */
@Injectable()
export class SessionManagerService implements OnModuleDestroy {
  private sessions = new Map<string, ActiveSession>();

  private readonly connectionConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'isolation_demo',
    user: process.env.DB_USER || 'demo',
    password: process.env.DB_PASSWORD || 'demo',
  };

  /**
   * Creates a new session with a dedicated database connection
   */
  async createSession(
    isolationLevel: IsolationLevel = 'READ COMMITTED',
  ): Promise<SessionState> {
    const sessionId = this.generateSessionId();
    const client = new Client(this.connectionConfig);

    await client.connect();

    const state: SessionState = {
      sessionId,
      inTransaction: false,
      isolationLevel,
      createdAt: new Date(),
    };

    this.sessions.set(sessionId, { client, state });

    return state;
  }

  /**
   * Executes an SQL query within the session context
   */
  async executeQuery(
    sessionId: string,
    sql: string,
  ): Promise<{ result?: QueryResult; error?: QueryError }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { error: { message: 'Session not found' } };
    }

    const { client, state } = session;
    const startTime = Date.now();

    try {
      // Auto-start transaction on first query
      if (!state.inTransaction) {
        await client.query(`BEGIN ISOLATION LEVEL ${state.isolationLevel}`);
        state.inTransaction = true;
      }

      const pgResult = await client.query(sql);
      const duration = Date.now() - startTime;

      const fields: FieldInfo[] =
        pgResult.fields?.map((f) => ({
          name: f.name,
          dataType: this.mapDataType(f.dataTypeID),
        })) || [];

      const result: QueryResult = {
        rows: pgResult.rows as Record<string, unknown>[],
        rowCount: pgResult.rowCount ?? 0,
        fields,
        duration,
      };

      return { result };
    } catch (err) {
      return { error: this.parseError(err) };
    }
  }

  /**
   * Commits the current transaction
   */
  async commit(
    sessionId: string,
  ): Promise<{ success: boolean; error?: QueryError }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: { message: 'Session not found' } };
    }

    try {
      await session.client.query('COMMIT');
      session.state.inTransaction = false;
      return { success: true };
    } catch (err) {
      return { success: false, error: this.parseError(err) };
    }
  }

  /**
   * Rolls back the current transaction
   */
  async rollback(
    sessionId: string,
  ): Promise<{ success: boolean; error?: QueryError }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: { message: 'Session not found' } };
    }

    try {
      await session.client.query('ROLLBACK');
      session.state.inTransaction = false;
      return { success: true };
    } catch (err) {
      return { success: false, error: this.parseError(err) };
    }
  }

  /**
   * Changes the isolation level (only allowed outside of a transaction)
   */
  setIsolationLevel(
    sessionId: string,
    level: IsolationLevel,
  ): { success: boolean; error?: QueryError } {
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

  /**
   * Returns the current session state
   */
  getSessionState(sessionId: string): SessionState | null {
    return this.sessions.get(sessionId)?.state ?? null;
  }

  /**
   * Fetches committed table data using a separate connection
   */
  async getCommittedData(table: string): Promise<Record<string, unknown>[]> {
    const client = new Client(this.connectionConfig);
    try {
      await client.connect();
      const result = await client.query(`SELECT * FROM ${table} ORDER BY id`);
      return result.rows as Record<string, unknown>[];
    } finally {
      await client.end();
    }
  }

  /**
   * Closes a session and releases its database connection
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      await session.client.end();
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Closes all sessions on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    for (const [sessionId] of this.sessions) {
      await this.closeSession(sessionId);
    }
  }

  /**
   * Converts an error to QueryError format
   */
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

  /**
   * Generates a unique session identifier
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Maps PostgreSQL OID to human-readable type name
   */
  private mapDataType(oid: number): string {
    const types: Record<number, string> = {
      23: 'integer',
      25: 'text',
      1043: 'varchar',
      1700: 'numeric',
      16: 'boolean',
      1114: 'timestamp',
    };
    return types[oid] || 'unknown';
  }
}
