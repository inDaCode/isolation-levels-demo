import { useState, useCallback } from 'react';
import type { Scenario } from '@isolation-demo/shared';
import { SCENARIOS } from '@/data/scenarios';

interface UseScenarioReturn {
  // Текущий сценарий
  scenario: Scenario | null;
  currentStep: number;
  isActive: boolean;

  // Действия
  start: (scenarioId: string) => void;
  stop: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;

  // Хелперы
  currentStepData: Scenario['steps'][number] | null;
  isFirstStep: boolean;
  isLastStep: boolean;
  isConclusion: boolean;
}

export function useScenario(): UseScenarioReturn {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const isActive = scenario !== null;
  const totalSteps = scenario?.steps.length ?? 0;

  // +1 для conclusion
  const isLastStep = currentStep === totalSteps - 1;
  const isConclusion = currentStep === totalSteps;
  const isFirstStep = currentStep === 0;

  const currentStepData = scenario?.steps[currentStep] ?? null;

  const start = useCallback((scenarioId: string) => {
    const found = SCENARIOS.find((s) => s.id === scenarioId);
    if (found) {
      setScenario(found);
      setCurrentStep(0);
    }
  }, []);

  const stop = useCallback(() => {
    setScenario(null);
    setCurrentStep(0);
  }, []);

  const nextStep = useCallback(() => {
    if (!scenario) return;
    const maxStep = scenario.steps.length; // включая conclusion
    setCurrentStep((prev) => Math.min(prev + 1, maxStep));
  }, [scenario]);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const goToStep = useCallback(
    (step: number) => {
      if (!scenario) return;
      const maxStep = scenario.steps.length;
      setCurrentStep(Math.max(0, Math.min(step, maxStep)));
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
    isLastStep,
    isConclusion,
  };
}
