import { useCallback, useRef } from 'react';
import { useSocket } from '@/hooks/use-socket';
import { useDatabaseSetup } from '@/hooks/use-database-setup';
import { useScenario } from '@/hooks/use-scenario';
import { Header } from '@/components/layout/header';
import { TerminalPanel, type TerminalHandle } from '@/components/terminal/terminal-panel';
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

  // Refs для управления терминалами из сценария
  const terminalRefs = useRef<{
    1: TerminalHandle | null;
    2: TerminalHandle | null;
    3: TerminalHandle | null;
  }>({ 1: null, 2: null, 3: null });

  const handleCopyToTerminal = useCallback((terminal: 1 | 2 | 3, sql: string) => {
    terminalRefs.current[terminal]?.setSql(sql);
  }, []);

  const handleRunInTerminal = useCallback((terminal: 1 | 2 | 3, sql: string) => {
    const ref = terminalRefs.current[terminal];
    if (ref) {
      ref.setSql(sql);
      ref.execute();
    }
  }, []);

  const handleScenarioSelect = useCallback(
    (scenarioId: string) => {
      reset(); // Сбросить данные перед сценарием
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
            {/* Scenario Panel или Explanation Panel */}
            {scenario.isActive && scenario.scenario ? (
              <ScenarioPanel
                scenario={scenario.scenario}
                currentStep={scenario.currentStep}
                isConclusion={scenario.isConclusion}
                onPrev={scenario.prevStep}
                onNext={scenario.nextStep}
                onCopyToTerminal={handleCopyToTerminal}
                onRunInTerminal={handleRunInTerminal}
              />
            ) : (
              <ExplanationPanel />
            )}

            <DatabaseState onReset={reset} isResetting={isResetting} />

            <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
              <TerminalPanel
                ref={(handle) => {
                  terminalRefs.current[1] = handle;
                }}
                terminalId={1}
                defaultIsolationLevel="READ COMMITTED"
              />
              <TerminalPanel
                ref={(handle) => {
                  terminalRefs.current[2] = handle;
                }}
                terminalId={2}
                defaultIsolationLevel="READ COMMITTED"
              />
              <TerminalPanel
                ref={(handle) => {
                  terminalRefs.current[3] = handle;
                }}
                terminalId={3}
                defaultIsolationLevel="READ COMMITTED"
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
