import path from 'path';
import { DEFAULT_LAYER_PATTERNS, DEFAULT_PRIORITY } from '@aircode/shared';

export function classifyFile(filePath: string): string {
  const normalized = filePath.split(path.sep).join('/');
  if (/\.(test|spec)\./i.test(normalized) || /\/__tests__\//.test(normalized)) {
    return 'test';
  }
  for (const layer of DEFAULT_PRIORITY) {
    for (const pattern of DEFAULT_LAYER_PATTERNS[layer] || []) {
      if (pattern.test(normalized)) return layer;
    }
  }
  return 'unknown';
}
