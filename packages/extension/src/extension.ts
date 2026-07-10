import * as vscode from 'vscode';
import { DatabaseManager } from '@aircode/core';
import { AnalysisOrchestrator } from './services/AnalysisOrchestrator';
import { DashboardPanel } from './panels/DashboardPanel';
import path from 'path';
import fs from 'fs';

let dbManager: DatabaseManager | undefined;

export async function activate(context: vscode.ExtensionContext) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) return;

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const dbPath = path.join(workspaceRoot, '.aircode', 'cache.duckdb');

  const airDir = path.dirname(dbPath);
  if (!fs.existsSync(airDir)) fs.mkdirSync(airDir, { recursive: true });

  dbManager = new DatabaseManager();
  await dbManager.open(dbPath);

  const orchestrator = new AnalysisOrchestrator(dbManager, workspaceRoot);

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'AIR-Code: indexando proyecto...' },
    async () => orchestrator.indexWorkspace()
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('aircode.analyzeIdea', async () => {
      const idea = await vscode.window.showInputBox({
        prompt: 'Describí el cambio que querés hacer',
        placeHolder: 'ej: migrar autenticación de sesiones a JWT',
      });
      if (!idea) return;

      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Analizando impacto...' },
        async () => {
          const result = await orchestrator.analyze(idea);
          DashboardPanel.render(context.extensionUri, result);
        }
      );
    }),
    vscode.commands.registerCommand('aircode.reindexAll', async () => {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'AIR-Code: reindexando todo...' },
        async () => orchestrator.indexWorkspace()
      );
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (doc) => {
      if (doc.uri.scheme === 'file') await orchestrator.reindexFile(doc.uri.fsPath);
    }),
    vscode.workspace.onDidCreateFiles(async (e) => {
      for (const f of e.files) {
        if (f.scheme === 'file') await orchestrator.reindexFile(f.fsPath);
      }
    }),
    vscode.workspace.onDidDeleteFiles(async (e) => {
      for (const f of e.files) {
        if (f.scheme === 'file') await orchestrator.removeFile(f.fsPath);
      }
    })
  );
}

export function deactivate() {
  return dbManager?.close();
}
