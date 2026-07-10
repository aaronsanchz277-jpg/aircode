import { tokenize } from '@aircode/shared';
import type { DatabaseManager } from '../storage/DatabaseManager';

export interface Candidate {
  symbolId: number;
  name: string;
  filePath: string;
  score: number;
}

export async function findCandidates(
  db: DatabaseManager,
  idea: string,
  limit = 10
): Promise<Candidate[]> {
  const tokens = tokenize(idea);
  if (tokens.length === 0) return [];

  const results: Map<number, Candidate> = new Map();

  for (const token of tokens) {
    const rows = await db.execute(`
      SELECT s.id AS id, s.name AS name, f.path AS path,
             CASE WHEN LOWER(s.name) = LOWER(?) THEN 1.0
                  WHEN LOWER(s.name) LIKE '%' || LOWER(?) || '%' THEN 0.6
                  WHEN LOWER(s.docstring) LIKE '%' || LOWER(?) || '%' THEN 0.4
                  WHEN LOWER(f.path) LIKE '%' || LOWER(?) || '%' THEN 0.3
                  ELSE 0 END AS score
      FROM symbol s JOIN file f ON s.file_id = f.id
      WHERE LOWER(s.name) LIKE '%' || LOWER(?) || '%'
         OR LOWER(s.docstring) LIKE '%' || LOWER(?) || '%'
         OR LOWER(f.path) LIKE '%' || LOWER(?) || '%'
    `, [token, token, token, token, token, token, token]);

    for (const row of rows) {
      const id = row.id as number;
      const existing = results.get(id);
      const newScore = (existing?.score ?? 0) + (row.score as number);
      results.set(id, {
        symbolId: id,
        name: row.name as string,
        filePath: row.path as string,
        score: newScore,
      });
    }
  }

  return [...results.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
