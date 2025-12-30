import { useState, useCallback } from 'react';
import { socket } from '@/lib/socket-client';
import {
  WS_EVENTS,
  type SessionState,
  type QueryResult,
  type QueryError,
  type IsolationLevel,
  type SessionCreatedEvent,
  type QueryResultEvent,
  type SessionOperationResult,
} from '@isolation-demo/shared';

interface UseSessionReturn {
  state: SessionState | null;
  lastResult: QueryResult | null;
  lastError: QueryError | null;
  isLoading: boolean;
  create: (isolationLevel?: IsolationLevel) => Promise<void>;
  execute: (sql: string) => Promise<void>;
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
  setIsolationLevel: (level: IsolationLevel) => Promise<void>;
}

export function useSession(): UseSessionReturn {
  const [state, setState] = useState<SessionState | null>(null);
  const [lastResult, setLastResult] = useState<QueryResult | null>(null);
  const [lastError, setLastError] = useState<QueryError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const create = useCallback(async (isolationLevel?: IsolationLevel) => {
    setIsLoading(true);
    try {
      const response: SessionCreatedEvent = await socket.emitWithAck(WS_EVENTS.SESSION_CREATE, {
        isolationLevel,
      });
      setState(response.state);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const execute = useCallback(
    async (sql: string) => {
      if (!state) return;

      setIsLoading(true);
      setLastError(null);
      try {
        const response: QueryResultEvent = await socket.emitWithAck(WS_EVENTS.SESSION_EXECUTE, {
          sessionId: state.sessionId,
          sql,
        });
        if (response.error) {
          setLastError(response.error);
          setLastResult(null);
        } else if (response.result) {
          setLastResult(response.result);
        }
        // Update session state (inTransaction, isolationLevel)
        if (response.state) {
          setState(response.state);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [state],
  );

  const commit = useCallback(async () => {
    if (!state) return;

    setIsLoading(true);
    try {
      const response: SessionOperationResult = await socket.emitWithAck(WS_EVENTS.SESSION_COMMIT, {
        sessionId: state.sessionId,
      });
      if (response.state) {
        setState(response.state);
      } else if (response.error) {
        setLastError({ message: response.error });
      }
    } finally {
      setIsLoading(false);
    }
  }, [state]);

  const rollback = useCallback(async () => {
    if (!state) return;

    setIsLoading(true);
    try {
      const response: SessionOperationResult = await socket.emitWithAck(
        WS_EVENTS.SESSION_ROLLBACK,
        { sessionId: state.sessionId },
      );
      if (response.state) {
        setState(response.state);
      } else if (response.error) {
        setLastError({ message: response.error });
      }
    } finally {
      setIsLoading(false);
    }
  }, [state]);

  const setIsolationLevel = useCallback(
    async (level: IsolationLevel) => {
      if (!state) return;

      const response: SessionOperationResult = await socket.emitWithAck(
        WS_EVENTS.SESSION_SET_ISOLATION,
        { sessionId: state.sessionId, level },
      );
      if (response.state) {
        setState(response.state);
      } else if (response.error) {
        setLastError({ message: response.error });
      }
    },
    [state],
  );

  return {
    state,
    lastResult,
    lastError,
    isLoading,
    create,
    execute,
    commit,
    rollback,
    setIsolationLevel,
  };
}
