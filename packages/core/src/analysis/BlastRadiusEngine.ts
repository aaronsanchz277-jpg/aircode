import { DatabaseManager } from '../storage/DatabaseManager';

export interface BlastRadiusResult {
  symbolId: number;
  name: string;
  filePath: string;
  layer: string;
  depth: number;
}

export class BlastRadiusEngine {
  constructor(private db: DatabaseManager) {}

  async compute(startSymbolId: number): Promise<BlastRadiusResult[]> {
    const rows = await this.db.execute(`
      WITH RECURSIVE blast_radius AS (
          SELECT id, from_symbol_id, to_symbol_id, 0 AS depth
          FROM edge
          WHERE to_symbol_id = ?

          UNION ALL

          SELECT e.id, e.from_symbol_id, e.to_symbol_id, b.depth + 1
          FROM edge e
          JOIN blast_radius b ON e.to_symbol_id = b.from_symbol_id
          WHERE b.depth < 5
      )
      SELECT DISTINCT s.id AS symbolId, s.name, f.path, f.layer, b.depth
      FROM blast_radius b
      JOIN symbol s ON b.from_symbol_id = s.id
      JOIN file f ON s.file_id = f.id
      ORDER BY b.depth ASC
    `, [startSymbolId]);

    return rows.map((r) => ({
      symbolId: r.symbolId as number,
      name: r.name as string,
      filePath: r.path as string,
      layer: r.layer as string,
      depth: r.depth as number,
    }));
  }
}
