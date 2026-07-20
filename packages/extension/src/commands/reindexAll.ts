import * as vscode from 'vscode';
import { AnalysisOrchestrator } from '../services/AnalysisOrchestrator';

export async function reindexAll(orchestrator: AnalysisOrchestrator): Promise<void> {
  const confirm = await vscode.window.showWarningMessage(
    '¿Estás seguro de que quieres reindexar todo el workspace? Esto puede tomar varios minutos.',
    { modal: true },
    'Sí, reindexar',
    'Cancelar'
  );

  if (confirm !== 'Sí, reindexar') {
    return;
  }

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Reindexando workspace...',
        cancellable: false,
      },
      async (progress) => {
        progress.report({ increment: 0 });
        await orchestrator.indexWorkspace();
        progress.report({ increment: 100 });
      }
    );

    vscode.window.showInformationMessage('Workspace reindexado correctamente.');
  } catch (error) {
    vscode.window.showErrorMessage(`Error durante la reindexación: ${(error as Error).message}`);
    console.error('reindexAll error:', error);
  }
}
