import { Badge } from '@/components/ui/badge';
import type { SocketStatus } from '@/hooks/use-socket';

interface HeaderProps {
  connectionStatus: SocketStatus;
  setupError?: string | null;
}

export function Header({ connectionStatus, setupError }: HeaderProps) {
  const statusColor =
    connectionStatus === 'connected'
      ? 'bg-green-500'
      : connectionStatus === 'connecting'
        ? 'bg-yellow-500'
        : 'bg-red-500';

  const statusText =
    connectionStatus === 'connected'
      ? 'Connected'
      : connectionStatus === 'connecting'
        ? 'Connecting...'
        : 'Disconnected';

  return (
    <header className="border-b border-zinc-800 px-4 py-3 shrink-0">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">PostgreSQL Isolation Levels Demo</h1>

        <div className="flex items-center gap-3">
          {setupError && <span className="text-xs text-red-400">{setupError}</span>}
          <Badge variant="outline" className="gap-1.5">
            <span className={`w-2 h-2 rounded-full ${statusColor}`} />
            {statusText}
          </Badge>
        </div>
      </div>
    </header>
  );
}
