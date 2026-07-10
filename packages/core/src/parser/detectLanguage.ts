import path from 'path';

export function detectLanguage(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.ts') return 'typescript';
  if (ext === '.tsx') return 'tsx';
  if (ext === '.js') return 'javascript';
  if (ext === '.jsx') return 'javascript';
  if (ext === '.py') return 'python';
  return null;
}
