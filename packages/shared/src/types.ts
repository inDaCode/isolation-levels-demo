/**
 * PostgreSQL transaction isolation levels
 */
export type IsolationLevel =
  | 'READ UNCOMMITTED'
  | 'READ COMMITTED'
  | 'REPEATABLE READ'
  | 'SERIALIZABLE';

/**
 * Database session state
 */
export interface SessionState {
  sessionId: string;
  inTransaction: boolean;
  isolationLevel: IsolationLevel;
  createdAt: Date;
}

/**
 * SQL query execution result
 */
export interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  fields: FieldInfo[];
  duration: number;
}

/**
 * Result column metadata
 */
export interface FieldInfo {
  name: string;
  dataType: string;
}

/**
 * Query execution error
 */
export interface QueryError {
  message: string;
  code?: string;
  detail?: string;
}

// ─────────────────────────────────────────────
// WebSocket Events: Client → Server
// ─────────────────────────────────────────────

export interface CreateSessionPayload {
  isolationLevel?: IsolationLevel;
}

export interface ExecuteQueryPayload {
  sessionId: string;
  sql: string;
}

export interface SessionActionPayload {
  sessionId: string;
}

export interface SetIsolationPayload {
  sessionId: string;
  level: IsolationLevel;
}

// ─────────────────────────────────────────────
// WebSocket Events: Server → Client
// ─────────────────────────────────────────────

export interface SessionCreatedEvent {
  sessionId: string;
  state: SessionState;
}

export interface QueryResultEvent {
  sessionId: string;
  result?: QueryResult;
  error?: QueryError;
}

export interface SessionStatusEvent {
  sessionId: string;
  state: SessionState;
}

export interface CommittedDataEvent {
  table: string;
  rows: Record<string, unknown>[];
}

export type SessionOperationResult =
  | { sessionId: string; state: SessionState; error?: undefined }
  | { sessionId: string; state?: undefined; error: string };

export interface SetupResponse {
  success: boolean;
  error?: string;
}

// ─────────────────────────────────────────────
// WebSocket Event Names
// ─────────────────────────────────────────────

export const WS_EVENTS = {
  // Client → Server
  SESSION_CREATE: 'session:create',
  SESSION_EXECUTE: 'session:execute',
  SESSION_COMMIT: 'session:commit',
  SESSION_ROLLBACK: 'session:rollback',
  SESSION_SET_ISOLATION: 'session:setIsolation',
  SESSION_DISCONNECT: 'session:disconnect',
  SETUP_EXECUTE: 'setup:execute',
  DATA_GET_COMMITTED: 'data:getCommitted',

  // Server → Client
  SESSION_CREATED: 'session:created',
  SESSION_RESULT: 'session:result',
  SESSION_STATUS: 'session:status',
  DATA_COMMITTED: 'data:committed',
} as const;
