import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';
import type { Scenario } from '@isolation-demo/shared';

interface ScenarioPanelProps {
  scenario: Scenario;
  currentStep: number;
  isConclusion: boolean;
  onPrev: () => void;
  onNext: () => void;
  onCopyToTerminal: (terminal: 1 | 2 | 3, sql: string) => void;
  onRunInTerminal: (terminal: 1 | 2 | 3, sql: string) => void;
}

export function ScenarioPanel({
  scenario,
  currentStep,
  isConclusion,
  onPrev,
  onNext,
  onCopyToTerminal,
}: ScenarioPanelProps) {
  const totalSteps = scenario.steps.length;
  const step = scenario.steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  if (isConclusion) {
    return (
      <Card className="p-4 shrink-0 border-green-900/50 bg-green-950/20">
        <div className="flex items-start gap-3">
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

            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={onPrev}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back to steps
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 shrink-0 border-blue-900/50 bg-blue-950/20">
      <div className="flex items-start gap-3">
        <Lightbulb className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="flex-1 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-blue-400">
              {scenario.title}
              <span className="text-zinc-500 font-normal ml-2">
                Step {currentStep + 1} of {totalSteps}
              </span>
            </h3>
          </div>

          {/* Explanation */}
          <p className="text-sm text-zinc-300">{step.explanation}</p>

          {/* SQL to execute */}
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
                onClick={() => onCopyToTerminal(step.terminal, step.sql)}
                title="Copy to terminal"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Expectation */}
          {step.expectation && (
            <div className="flex items-start gap-2 px-3 py-2 bg-amber-950/30 border border-amber-900/50 rounded">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-200">{step.expectation}</p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
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
      </div>
    </Card>
  );
}
