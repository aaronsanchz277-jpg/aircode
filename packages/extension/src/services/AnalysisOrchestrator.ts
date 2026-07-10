import {
  DatabaseManager,
  DuckTreeIndexer,
  BlastRadiusEngine,
  findCandidates,
  GitAnalyzer,
  calculateComplexity,
} from '@aircode/core';
import * as path from 'path';

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
      const fanOut = data.symbols.length;
      const complexity = 1;
      const risk = Math.min(
        Math.round(
          (fanOut / 10) * 0.4 + (commits / 15) * 0.4 + (complexity / 10) * 0.2
        ) * 100,
        100
      );

      files.push({
        path: filePath,
        layer: data.layer,
        risk,
        fanOut,
        commits,
        complexity,
        snippet: '',
      });

      graphNodes.push({ id: filePath, label: filePath, risk });
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
