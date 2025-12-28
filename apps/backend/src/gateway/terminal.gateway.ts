import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SessionManagerService } from '../database/session-manager.service';
import type {
  CreateSessionPayload,
  ExecuteQueryPayload,
  SessionActionPayload,
  SetIsolationPayload,
  SessionCreatedEvent,
  QueryResultEvent,
  SessionStatusEvent,
  CommittedDataEvent,
} from '@isolation-demo/shared';

/**
 * WebSocket gateway for SQL terminal sessions.
 * Handles real-time communication between frontend terminals and database sessions.
 */
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class TerminalGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  /** Maps socket.id to sessionId[] for cleanup on disconnect */
  private socketSessions = new Map<string, string[]>();

  constructor(private sessionManager: SessionManagerService) {}

  handleConnection(client: Socket): void {
    console.log(`Client connected: ${client.id}`);
    this.socketSessions.set(client.id, []);
  }

  async handleDisconnect(client: Socket): Promise<void> {
    console.log(`Client disconnected: ${client.id}`);

    const sessions = this.socketSessions.get(client.id) ?? [];
    for (const sessionId of sessions) {
      await this.sessionManager.closeSession(sessionId);
    }
    this.socketSessions.delete(client.id);
  }

  /**
   * Creates a new database session for the client
   */
  @SubscribeMessage('session:create')
  async handleCreateSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CreateSessionPayload,
  ): Promise<SessionCreatedEvent> {
    const state = await this.sessionManager.createSession(
      payload?.isolationLevel,
    );

    // Track socket-to-session mapping for cleanup
    const sessions = this.socketSessions.get(client.id) ?? [];
    sessions.push(state.sessionId);
    this.socketSessions.set(client.id, sessions);

    return { sessionId: state.sessionId, state };
  }

  /**
   * Executes an SQL query in the specified session
   */
  @SubscribeMessage('session:execute')
  async handleExecuteQuery(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ExecuteQueryPayload,
  ): Promise<QueryResultEvent> {
    const { sessionId, sql } = payload;
    const { result, error } = await this.sessionManager.executeQuery(
      sessionId,
      sql,
    );

    // Send updated session status to client
    const state = this.sessionManager.getSessionState(sessionId);
    if (state) {
      const statusEvent: SessionStatusEvent = { sessionId, state };
      client.emit('session:status', statusEvent);
    }

    return { sessionId, result, error };
  }

  /**
   * Commits the transaction in the specified session
   */
  @SubscribeMessage('session:commit')
  async handleCommit(
    @ConnectedSocket() _client: Socket,
    @MessageBody() payload: SessionActionPayload,
  ): Promise<SessionStatusEvent | { sessionId: string; error: string }> {
    const { sessionId } = payload;

    await this.sessionManager.commit(sessionId);

    const state = this.sessionManager.getSessionState(sessionId);
    if (!state) {
      return { sessionId, error: 'Session not found' };
    }

    // Broadcast updated committed data to all clients
    await this.broadcastCommittedData();

    return { sessionId, state };
  }

  /**
   * Rolls back the transaction in the specified session
   */
  @SubscribeMessage('session:rollback')
  async handleRollback(
    @ConnectedSocket() _client: Socket,
    @MessageBody() payload: SessionActionPayload,
  ): Promise<SessionStatusEvent | { sessionId: string; error: string }> {
    const { sessionId } = payload;

    await this.sessionManager.rollback(sessionId);

    const state = this.sessionManager.getSessionState(sessionId);
    if (!state) {
      return { sessionId, error: 'Session not found' };
    }

    return { sessionId, state };
  }

  /**
   * Changes the isolation level for the specified session
   */
  @SubscribeMessage('session:setIsolation')
  handleSetIsolation(
    @ConnectedSocket() _client: Socket,
    @MessageBody() payload: SetIsolationPayload,
  ): SessionStatusEvent & { error?: string } {
    const { sessionId, level } = payload;
    const { success, error } = this.sessionManager.setIsolationLevel(
      sessionId,
      level,
    );

    const state = this.sessionManager.getSessionState(sessionId);
    if (!state) {
      return {
        sessionId,
        state: null as unknown as SessionStatusEvent['state'],
        error: 'Session not found',
      };
    }

    if (!success) {
      return { sessionId, state, error: error?.message };
    }

    return { sessionId, state };
  }

  /**
   * Returns the committed data for a specific table
   */
  @SubscribeMessage('data:getCommitted')
  async handleGetCommitted(
    @MessageBody() payload: { table: string },
  ): Promise<CommittedDataEvent> {
    const rows = await this.sessionManager.getCommittedData(payload.table);
    return { table: payload.table, rows };
  }

  /**
   * Broadcasts committed data changes to all connected clients
   */
  private async broadcastCommittedData(): Promise<void> {
    const tables = ['accounts', 'products'];
    for (const table of tables) {
      const rows = await this.sessionManager.getCommittedData(table);
      const event: CommittedDataEvent = { table, rows };
      this.server.emit('data:committed', event);
    }
  }
}
