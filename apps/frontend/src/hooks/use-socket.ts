import { useEffect, useState } from 'react';
import { socket } from '@/lib/socket-client';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export function useSocket() {
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
