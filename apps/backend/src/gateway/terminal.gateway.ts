import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { SessionManagerService } from '../database/session-manager.service';
import {
  WS_EVENTS,
  type CreateSessionPayload,
  type ExecuteQueryPayload,
  type SessionActionPayload,
  type SetIsolationPayload,
  type SessionCreatedEvent,
  type QueryResultEvent,
  type SessionOperationResult,
  type SetupResponse,
  type CommittedDataEvent,
} from '@isolation-demo/shared';

const DEMO_TABLES = ['accounts', 'products'] as const;

/**
 * WebSocket gateway for SQL terminal sessions.
 * Handles real-time communication between frontend terminals and database sessions.
 */
@WebSocketGateway({
  cors: { origin: '*' },
})
export class TerminalGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(TerminalGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  private readonly socketSessions = new Map<string, Set<string>>();

  constructor(private readonly sessionManager: SessionManagerService) {}

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
    this.socketSessions.set(client.id, new Set());
  }

  async handleDisconnect(client: Socket): Promise<void> {
    this.logger.log(`Client disconnected: ${client.id}`);

    const sessionIds = this.socketSessions.get(client.id);
    if (sessionIds) {
      await Promise.allSettled(
        Array.from(sessionIds).map((id) =>
          this.sessionManager.closeSession(id),
        ),
      );
    }
    this.socketSessions.delete(client.id);
  }

  @SubscribeMessage(WS_EVENTS.SESSION_CREATE)
  async handleCreateSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CreateSessionPayload,
  ): Promise<SessionCreatedEvent> {
    const state = await this.sessionManager.createSession(
      payload?.isolationLevel,
    );
    this.socketSessions.get(client.id)?.add(state.sessionId);
    return { sessionId: state.sessionId, state };
  }

  @SubscribeMessage(WS_EVENTS.SESSION_EXECUTE)
  async handleExecuteQuery(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ExecuteQueryPayload,
  ): Promise<QueryResultEvent> {
    const { sessionId, sql } = payload;
    const { result, error } = await this.sessionManager.executeQuery(
      sessionId,
      sql,
    );

    const state = this.sessionManager.getSessionState(sessionId) ?? undefined;

    // Broadcast committed data after autocommit queries
    // When not in explicit transaction, any query commits immediately,
    // so we refresh the committed data view for all clients
    if (!error && !state?.inTransaction) {
      await this.broadcastCommittedData();
    }

    return { sessionId, result, error, state };
  }

  @SubscribeMessage(WS_EVENTS.SESSION_COMMIT)
  async handleCommit(
    @MessageBody() payload: SessionActionPayload,
  ): Promise<SessionOperationResult> {
    const { sessionId } = payload;
    const { error } = await this.sessionManager.commit(sessionId);

    if (error) {
      return { sessionId, error: error.message };
    }

    await this.broadcastCommittedData();

    const state = this.sessionManager.getSessionState(sessionId);
    if (!state) {
      return { sessionId, error: 'Session not found' };
    }

    return { sessionId, state };
  }

  @SubscribeMessage(WS_EVENTS.SESSION_ROLLBACK)
  async handleRollback(
    @MessageBody() payload: SessionActionPayload,
  ): Promise<SessionOperationResult> {
    const { sessionId } = payload;
    const { error } = await this.sessionManager.rollback(sessionId);

    if (error) {
      return { sessionId, error: error.message };
    }

    const state = this.sessionManager.getSessionState(sessionId);
    if (!state) {
      return { sessionId, error: 'Session not found' };
    }

    return { sessionId, state };
  }

  @SubscribeMessage(WS_EVENTS.SESSION_SET_ISOLATION)
  handleSetIsolation(
    @MessageBody() payload: SetIsolationPayload,
  ): SessionOperationResult {
    const { sessionId, level } = payload;

    const currentState = this.sessionManager.getSessionState(sessionId);
    if (!currentState) {
      return { sessionId, error: 'Session not found' };
    }

    const { error } = this.sessionManager.setIsolationLevel(sessionId, level);
    if (error) {
      return { sessionId, error: error.message };
    }

    const state = this.sessionManager.getSessionState(sessionId);
    if (!state) {
      return { sessionId, error: 'Session not found' };
    }

    return { sessionId, state };
  }

  @SubscribeMessage(WS_EVENTS.DATA_GET_COMMITTED)
  async handleGetCommitted(
    @MessageBody() payload: { table: string },
  ): Promise<CommittedDataEvent> {
    const rows = await this.sessionManager.getCommittedData(payload.table);
    return { table: payload.table, rows };
  }

  @SubscribeMessage(WS_EVENTS.SETUP_EXECUTE)
  async handleSetupExecute(
    @MessageBody() payload: { sql: string },
  ): Promise<SetupResponse> {
    const { success, error } = await this.sessionManager.executeSetup(
      payload.sql,
    );

    if (success) {
      await this.broadcastCommittedData();
    }

    return { success, error: error?.message };
  }

  private async broadcastCommittedData(): Promise<void> {
    await Promise.all(
      DEMO_TABLES.map(async (table) => {
        const rows = await this.sessionManager.getCommittedData(table);
        const event: CommittedDataEvent = { table, rows };
        this.server.emit(WS_EVENTS.DATA_COMMITTED, event);
      }),
    );
  }
}
