import type { IsolationLevel } from './types.js';

export interface ScenarioStep {
  terminal: 1 | 2 | 3;
  sql: string;
  explanation: string;
  expectation?: string;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  difficulty: 'basic' | 'intermediate' | 'advanced';
  terminals: 2 | 3;
  setup: {
    isolationLevels: [IsolationLevel, IsolationLevel, IsolationLevel?];
  };
  steps: ScenarioStep[];
  conclusion: {
    problem: string;
    solution: string;
  };
}
