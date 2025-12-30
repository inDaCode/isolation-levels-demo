import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

interface HeaderProps {
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  onReset: () => Promise<boolean>;
  isResetting: boolean;
  setupError: string | null;
}

export function Header({ connectionStatus, onReset, isResetting, setupError }: HeaderProps) {
  const statusColor = {
    connected: 'bg-green-500',
    connecting: 'bg-yellow-500',
    disconnected: 'bg-red-500',
  }[connectionStatus];

  return (
    <header className="flex items-center justify-between py-3 px-4 border-b border-zinc-800">
      <div>
        <h1 className="text-xl font-bold">PostgreSQL Isolation Levels Demo</h1>
        <p className="text-sm text-zinc-400">
          Explore how different isolation levels affect transaction visibility
        </p>
      </div>

      <div className="flex items-center gap-3">
        {setupError && <span className="text-sm text-red-400">{setupError}</span>}

        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          disabled={isResetting || connectionStatus !== 'connected'}
        >
          <RotateCcw className={`w-4 h-4 mr-2 ${isResetting ? 'animate-spin' : ''}`} />
          Reset DB
        </Button>

        <Badge variant="outline" className="gap-2">
          <span className={`w-2 h-2 rounded-full ${statusColor}`} />
          {connectionStatus}
        </Badge>
      </div>
    </header>
  );
}
