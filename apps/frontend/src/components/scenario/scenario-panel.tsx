import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Play,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';
import { useSessionStore, type TerminalId } from '@/stores/session-store';
import type { Scenario } from '@/data/scenarios';

interface ScenarioPanelProps {
  scenario: Scenario;
  currentStep: number;
  isConclusion: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export function ScenarioPanel({
  scenario,
  currentStep,
  isConclusion,
  onPrev,
  onNext,
}: ScenarioPanelProps) {
  const setSql = useSessionStore((s) => s.setSql);
  const executeWithSql = useSessionStore((s) => s.executeWithSql);

  const totalSteps = scenario.steps.length;
  const step = scenario.steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  const handleInsertToTerminal = (terminal: TerminalId, sql: string) => {
    setSql(terminal, sql);
  };

  const handleRunInTerminal = (terminal: TerminalId, sql: string) => {
    executeWithSql(terminal, sql);
  };

  if (isConclusion) {
    return (
      <Card className="p-4 h-full border-green-900/50 bg-green-950/20 overflow-y-auto">
        <div className="flex flex-col h-full">
          <div className="flex items-start gap-3 flex-1">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-3">
              <div>
                <h3 className="font-semibold text-green-400 mb-1">Scenario Complete!</h3>
                <p className="text-sm text-zinc-300">{scenario.title}</p>
              </div>

              <div className="space-y-2">
                <div>
                  <span className="text-xs font-medium text-zinc-400">Problem:</span>
                  <p className="text-sm text-zinc-300">{scenario.conclusion.problem}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-zinc-400">Solution:</span>
                  <p className="text-sm text-zinc-300">{scenario.conclusion.solution}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-green-900/30 mt-3">
            <Button variant="ghost" size="sm" onClick={onPrev}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back to steps
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const terminalId = step.terminal as TerminalId;

  return (
    <Card className="p-4 h-full border-blue-900/50 bg-blue-950/20 overflow-y-auto">
      <div className="flex flex-col h-full">
        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-blue-400">
              {scenario.title}
              <span className="text-zinc-500 font-normal ml-2">
                Step {currentStep + 1} of {totalSteps}
              </span>
            </h3>
          </div>

          <p className="text-sm text-zinc-300">{step.explanation}</p>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span>👉 Execute in Terminal {step.terminal}:</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm font-mono text-zinc-200">
                {step.sql}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleInsertToTerminal(terminalId, step.sql)}
                title="Copy to terminal"
              >
                <Copy className="w-4 h-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleRunInTerminal(terminalId, step.sql)}
                title="Run in terminal"
              >
                <Play className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {step.expectation && (
            <div className="flex items-start gap-2 px-3 py-2 bg-amber-950/30 border border-amber-900/50 rounded">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-200">{step.expectation}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-blue-900/30 mt-3">
          <Button variant="ghost" size="sm" onClick={onPrev} disabled={isFirstStep}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <Button variant="secondary" size="sm" onClick={onNext}>
            {isLastStep ? 'See conclusion' : 'Done, next'}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
