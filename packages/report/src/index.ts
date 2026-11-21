import type { ScanResult } from '@vibe-fucking/core';

export { renderTerminal } from './terminal';

export function renderJson(result: ScanResult): string {
  return JSON.stringify(result, null, 2);
}
