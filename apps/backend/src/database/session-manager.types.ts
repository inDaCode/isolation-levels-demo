import type { Client } from 'pg';
import type {
  SessionState,
  QueryResult,
  QueryError,
} from '@isolation-demo/shared';

export type TerminalId = 1 | 2 | 3;

export interface ActiveSession {
  client: Client;
  state: SessionState;
  terminalId: TerminalId;
}

export type TransactionCommand = 'BEGIN' | 'COMMIT' | 'ROLLBACK';

export interface OperationResult {
  success: boolean;
  error?: QueryError;
}

export interface QueryExecutionResult {
  result?: QueryResult;
  error?: QueryError;
  uncommitted?: import('@isolation-demo/shared').UncommittedSnapshot;
}

export const ALLOWED_TABLES = ['accounts', 'products'] as const;
export type AllowedTable = (typeof ALLOWED_TABLES)[number];

export const PG_TYPE_MAP: Record<number, string> = {
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
