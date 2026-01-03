import { useCallback } from 'react';
import { useSocket } from '@/hooks/use-socket';
import { useDatabaseSetup } from '@/hooks/use-database-setup';
import { useScenario } from '@/hooks/use-scenario';
import { Header } from '@/components/layout/header';
import { TerminalPanel } from '@/components/terminal/terminal-panel';
import { DatabaseState } from '@/components/database-state/database-state';
import { ExplanationPanel } from '@/components/explanation/explanation-panel';
import { ScenarioPanel } from '@/components/scenario/scenario-panel';

function App() {
  const { status } = useSocket();
  const {
    isReady,
    isLoading: isResetting,
    error: setupError,
    reset,
  } = useDatabaseSetup(status === 'connected');

  const scenario = useScenario();

  const handleScenarioSelect = useCallback(
    (scenarioId: string) => {
      reset();
      scenario.start(scenarioId);
    },
    [reset, scenario],
  );

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <Header
        connectionStatus={status}
        setupError={setupError}
        currentScenario={scenario.scenario}
        onScenarioSelect={handleScenarioSelect}
        onScenarioExit={scenario.stop}
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
            {scenario.isActive && scenario.scenario ? (
              <ScenarioPanel
                scenario={scenario.scenario}
                currentStep={scenario.currentStep}
                isConclusion={scenario.isConclusion}
                onPrev={scenario.prevStep}
                onNext={scenario.nextStep}
              />
            ) : (
              <ExplanationPanel />
            )}

            <DatabaseState onReset={reset} isResetting={isResetting} />

            <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
              <TerminalPanel terminalId={1} defaultIsolationLevel="READ COMMITTED" />
              <TerminalPanel terminalId={2} defaultIsolationLevel="READ COMMITTED" />
              <TerminalPanel terminalId={3} defaultIsolationLevel="READ COMMITTED" />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
