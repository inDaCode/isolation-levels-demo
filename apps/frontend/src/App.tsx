import { useSocket } from '@/hooks/use-socket';
import { Badge } from '@/components/ui/badge';
import { TerminalPanel } from '@/components/terminal/terminal-panel';

function App() {
  const { status } = useSocket();

  const statusColor = {
    connected: 'bg-green-500',
    connecting: 'bg-yellow-500',
    disconnected: 'bg-red-500',
  }[status];

  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">PostgreSQL Isolation Levels Demo</h1>
        <Badge variant="outline" className="gap-2">
          <span className={`w-2 h-2 rounded-full ${statusColor}`} />
          {status}
        </Badge>
      </div>

      {status === 'connected' ? (
        <div className="grid grid-cols-2 gap-4 h-[calc(100vh-100px)]">
          <TerminalPanel title="Terminal 1" defaultIsolationLevel="READ COMMITTED" />
          <TerminalPanel title="Terminal 2" defaultIsolationLevel="READ COMMITTED" />
        </div>
      ) : (
        <div className="text-zinc-400">Connecting to server...</div>
      )}
    </div>
  );
}

export default App;
