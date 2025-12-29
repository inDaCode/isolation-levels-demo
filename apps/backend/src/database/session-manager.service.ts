import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Client, DatabaseError } from 'pg';
import type {
  IsolationLevel,
  SessionState,
  QueryResult,
  QueryError,
  FieldInfo,
} from '@isolation-demo/shared';

interface ActiveSession {
  client: Client;
  state: SessionState;
}

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

/**
 * Manages PostgreSQL sessions for isolation level demonstration.
 * Each session maintains its own dedicated database connection.
 */
@Injectable()
export class SessionManagerService implements OnModuleDestroy {
  private readonly logger = new Logger(SessionManagerService.name);
  private readonly sessions = new Map<string, ActiveSession>();

  private readonly connectionConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'isolation_demo',
    user: process.env.DB_USER || 'demo',
    password: process.env.DB_PASSWORD || 'demo',
  };

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

  async executeQuery(
    sessionId: string,
    sql: string,
  ): Promise<{ result?: QueryResult; error?: QueryError }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { error: { message: 'Session not found' } };
    }

    const { client, state } = session;
    const startTime = performance.now();

    try {
      if (!state.inTransaction) {
        await client.query(`BEGIN ISOLATION LEVEL ${state.isolationLevel}`);
        state.inTransaction = true;
      }

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
      return { error: this.parseError(err) };
    }
  }

  async commit(
    sessionId: string,
  ): Promise<{ success: boolean; error?: QueryError }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: { message: 'Session not found' } };
    }

    if (!session.state.inTransaction) {
      return { success: false, error: { message: 'No active transaction' } };
    }

    try {
      await session.client.query('COMMIT');
      session.state.inTransaction = false;
      return { success: true };
    } catch (err) {
      return { success: false, error: this.parseError(err) };
    }
  }

  async rollback(
    sessionId: string,
  ): Promise<{ success: boolean; error?: QueryError }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: { message: 'Session not found' } };
    }

    if (!session.state.inTransaction) {
      return { success: false, error: { message: 'No active transaction' } };
    }

    try {
      await session.client.query('ROLLBACK');
      session.state.inTransaction = false;
      return { success: true };
    } catch (err) {
      return { success: false, error: this.parseError(err) };
    }
  }

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

  getSessionState(sessionId: string): SessionState | null {
    return this.sessions.get(sessionId)?.state ?? null;
  }

  async getCommittedData(table: string): Promise<Record<string, unknown>[]> {
    const client = new Client(this.connectionConfig);
    try {
      await client.connect();
      const result = await client.query(`SELECT * FROM ${table} ORDER BY id`);
      return result.rows as Record<string, unknown>[];
    } catch {
      return [];
    } finally {
      await client.end().catch(() => {});
    }
  }

  async executeSetup(
    sql: string,
  ): Promise<{ success: boolean; error?: QueryError }> {
    const client = new Client(this.connectionConfig);
    try {
      await client.connect();
      await client.query(sql);
      return { success: true };
    } catch (err) {
      return { success: false, error: this.parseError(err) };
    } finally {
      await client.end().catch(() => {});
    }
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

  async onModuleDestroy(): Promise<void> {
    const closePromises = Array.from(this.sessions.keys()).map((id) =>
      this.closeSession(id),
    );
    await Promise.allSettled(closePromises);
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
