import { useEffect, useState } from 'react';
import { socket } from '@/lib/socket-client';
import type { Socket } from 'socket.io-client';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface UseSocketReturn {
  socket: Socket;
  status: ConnectionStatus;
}

export function useSocket(): UseSocketReturn {
  const [status, setStatus] = useState<ConnectionStatus>(() =>
    socket.connected ? 'connected' : 'disconnected',
  );

  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    const onConnect = () => setStatus('connected');
    const onDisconnect = () => setStatus('disconnected');
    const onConnectError = () => setStatus('disconnected');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
    };
  }, []);

  return { socket, status };
}
