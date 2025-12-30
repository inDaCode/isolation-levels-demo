import { useSocket } from '@/hooks/use-socket';
import { useDatabaseSetup } from '@/hooks/use-database-setup';
import { Header } from '@/components/layout/header';
import { TerminalPanel } from '@/components/terminal/terminal-panel';
import { DatabaseState } from '@/components/database-state/database-state';

function App() {
  const { status } = useSocket();
  const {
    isReady,
    isLoading: isResetting,
    error: setupError,
    reset,
  } = useDatabaseSetup(status === 'connected');

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <Header
        connectionStatus={status}
        onReset={reset}
        isResetting={isResetting}
        setupError={setupError}
      />

      <main className="flex-1 p-4 overflow-hidden flex flex-col gap-4">
        {status !== 'connected' ? (
          <div className="flex items-center justify-center h-full text-zinc-400">
            Connecting to server...
          </div>
        ) : !isReady ? (
          <div className="flex items-center justify-center h-full text-zinc-400">
            {isResetting ? 'Setting up database...' : 'Waiting for database...'}
          </div>
        ) : (
          <>
            <DatabaseState />
            <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
              <TerminalPanel title="Terminal 1" defaultIsolationLevel="READ COMMITTED" />
              <TerminalPanel title="Terminal 2" defaultIsolationLevel="READ COMMITTED" />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
