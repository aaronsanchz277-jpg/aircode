import {
  DatabaseManager,
  DuckTreeIndexer,
  BlastRadiusEngine,
  findCandidates,
  GitAnalyzer,
  calculateComplexity,
} from '@aircode/core';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface AnalysisResult {
  idea: string;
  files: Array<{
    path: string;
    layer: string;
    risk: number;
    fanOut: number;
    commits: number;
    complexity: number;
    snippet: string;
  }>;
  graph: {
    nodes: Array<{ id: string; label: string; risk: number }>;
    edges: Array<{ from: string; to: string }>;
  };
  message?: string;
}

export class AnalysisOrchestrator {
  private indexer: DuckTreeIndexer;
  private blastRadius: BlastRadiusEngine;
  private gitAnalyzer: GitAnalyzer;

  constructor(private db: DatabaseManager, private workspaceRoot: string) {
    this.indexer = new DuckTreeIndexer(db);
    this.blastRadius = new BlastRadiusEngine(db);
    this.gitAnalyzer = new GitAnalyzer();
  }

  async indexWorkspace(): Promise<void> {
    await this.indexer.indexWorkspace(this.workspaceRoot);
  }

  async reindexFile(filePath: string): Promise<void> {
    await this.indexer.indexFile(filePath, this.workspaceRoot);
  }

  async removeFile(filePath: string): Promise<void> {
    const relPath = filePath.replace(this.workspaceRoot, '').replace(/^[/\\]/, '');
    await this.db.execute('DELETE FROM file WHERE path = ?', [relPath]);
  }

  async analyze(idea: string): Promise<AnalysisResult> {
    const candidates = await findCandidates(this.db, idea);
    if (candidates.length === 0) {
      return {
        idea,
        files: [],
        graph: { nodes: [], edges: [] },
        message: 'No se encontraron símbolos relacionados con tu idea. Probá con otros términos.',
      };
    }

    const topCandidates = candidates.slice(0, 3);
    const affectedFiles = new Map<string, any>();

    for (const cand of topCandidates) {
      const blastResults = await this.blastRadius.compute(cand.symbolId);
      for (const br of blastResults) {
        if (!affectedFiles.has(br.filePath)) {
          affectedFiles.set(br.filePath, { symbols: [], layer: br.layer });
        }
        affectedFiles.get(br.filePath)!.symbols.push(br);
      }
    }

    const files: AnalysisResult['files'] = [];
    const graphNodes: any[] = [];
    const graphEdges: any[] = [];

    for (const [filePath, data] of affectedFiles.entries()) {
      const absPath = path.join(this.workspaceRoot, filePath);
      const commits = await this.gitAnalyzer.countRecentCommits(absPath);
      
      // Calculate complexity from AST
      let complexity = 1;
      try {
        const content = await fs.readFile(absPath, 'utf-8');
        const { createParser } = await import('@aircode/core');
        const { detectLanguage } = await import('@aircode/core');
        const language = detectLanguage(absPath);
        if (language) {
          const parser = await createParser(language);
          const ast = parser.parse(content);
          // Calculate average complexity for symbols in this file
          const symbolRows = await this.db.execute(
            'SELECT line_start, line_end FROM symbol WHERE file_id = (SELECT id FROM file WHERE path = ?)',
            [filePath]
          );
          if (symbolRows.length > 0) {
            const complexities = symbolRows.map(row => 
              calculateComplexity(ast, language, row.line_start as number, row.line_end as number)
            );
            complexity = Math.round(complexities.reduce((a, b) => a + b, 0) / complexities.length);
          }
        }
      } catch (error) {
        console.error(`Error calculating complexity for ${filePath}:`, error);
      }

      const fanOut = data.symbols.length;
      const risk = Math.min(
        Math.round(
          (fanOut / 10) * 0.4 + (commits / 15) * 0.4 + (complexity / 10) * 0.2
        ) * 100,
        100
      );

      // Get snippet from first symbol
      let snippet = '';
      try {
        const symbolRow = await this.db.execute(
          `SELECT s.docstring, f.absolute_path 
           FROM symbol s 
           JOIN file f ON s.file_id = f.id 
           WHERE f.path = ? 
           LIMIT 1`,
          [filePath]
        );
        if (symbolRow.length > 0 && symbolRow[0].docstring) {
          snippet = symbolRow[0].docstring as string;
        } else {
          const content = await fs.readFile(absPath, 'utf-8');
          const lines = content.split('\n');
          snippet = lines.slice(0, 10).join('\n');
        }
      } catch (error) {
        snippet = 'Snippet no disponible';
      }

      files.push({
        path: filePath,
        layer: data.layer,
        risk,
        fanOut,
        commits,
        complexity,
        snippet,
      });

      graphNodes.push({ id: filePath, label: path.basename(filePath), risk });
      graphEdges.push({ from: 'idea', to: filePath });
    }

    return {
      idea,
      files,
      graph: {
        nodes: [{ id: 'idea', label: idea.substring(0, 30), risk: 0 }, ...graphNodes],
        edges: graphEdges,
      },
    };
  }
}
