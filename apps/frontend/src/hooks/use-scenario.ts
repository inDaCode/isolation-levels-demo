import { useState, useCallback } from 'react';
import { SCENARIOS, type Scenario } from '@/data/scenarios';
import { useSessionStore, type TerminalId } from '@/stores/session-store';
import type { IsolationLevel } from '@isolation-demo/shared';

const DEFAULT_ISOLATION_LEVEL: IsolationLevel = 'READ COMMITTED';
const TERMINAL_IDS: TerminalId[] = [1, 2, 3];

interface UseScenarioReturn {
  scenario: Scenario | null;
  currentStep: number;
  isActive: boolean;

  start: (scenarioId: string) => void;
  stop: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;

  currentStepData: Scenario['steps'][number] | null;
  isFirstStep: boolean;
  hasNextStep: boolean;
  isConclusion: boolean;
  totalSteps: number;
}

export function useScenario(): UseScenarioReturn {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const setIsolationLevel = useSessionStore((s) => s.setIsolationLevel);

  const isActive = scenario !== null;
  const totalSteps = scenario?.steps.length ?? 0;

  const isFirstStep = currentStep === 0;
  const isConclusion = currentStep === totalSteps;
  const hasNextStep = currentStep < totalSteps;

  const currentStepData = scenario?.steps[currentStep] ?? null;

  const applyIsolationLevels = useCallback(
    (levels: Scenario['setup']['isolationLevels']) => {
      TERMINAL_IDS.forEach((terminalId, index) => {
        const level = levels[index] ?? DEFAULT_ISOLATION_LEVEL;
        setIsolationLevel(terminalId, level);
      });
    },
    [setIsolationLevel],
  );

  const resetIsolationLevels = useCallback(() => {
    TERMINAL_IDS.forEach((terminalId) => {
      setIsolationLevel(terminalId, DEFAULT_ISOLATION_LEVEL);
    });
  }, [setIsolationLevel]);

  const start = useCallback(
    (scenarioId: string) => {
      const found = SCENARIOS.find((s) => s.id === scenarioId);
      if (found) {
        setScenario(found);
        setCurrentStep(0);
        applyIsolationLevels(found.setup.isolationLevels);
      }
    },
    [applyIsolationLevels],
  );

  const stop = useCallback(() => {
    setScenario(null);
    setCurrentStep(0);
    resetIsolationLevels();
  }, [resetIsolationLevels]);

  const nextStep = useCallback(() => {
    if (!scenario) return;
    setCurrentStep((prev) => Math.min(prev + 1, scenario.steps.length));
  }, [scenario]);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const goToStep = useCallback(
    (step: number) => {
      if (!scenario) return;
      setCurrentStep(Math.max(0, Math.min(step, scenario.steps.length)));
    },
    [scenario],
  );

  return {
    scenario,
    currentStep,
    isActive,
    start,
    stop,
    nextStep,
    prevStep,
    goToStep,
    currentStepData,
    isFirstStep,
    hasNextStep,
    isConclusion,
    totalSteps,
  };
}
