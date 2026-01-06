import type { TerminalId } from '@/stores/session-store';

export const TERMINAL_COLORS: Record<TerminalId, { bg: string; text: string; label: string }> = {
  1: { bg: 'bg-blue-900/30', text: 'text-blue-400', label: 'T1' },
  2: { bg: 'bg-green-900/30', text: 'text-green-400', label: 'T2' },
  3: { bg: 'bg-orange-900/30', text: 'text-orange-400', label: 'T3' },
};
