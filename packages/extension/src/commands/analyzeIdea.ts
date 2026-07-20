import * as vscode from 'vscode';
import { AnalysisOrchestrator } from '../services/AnalysisOrchestrator';

export async function analyzeIdea(orchestrator: AnalysisOrchestrator): Promise<void> {
  const idea = await vscode.window.showInputBox({
    prompt: 'Describe la idea o cambio que quieres analizar',
    placeHolder: 'Ej: Agregar autenticación con OAuth2',
    ignoreFocusOut: true,
  });

  if (!idea) {
    vscode.window.showInformationMessage('Análisis cancelado.');
    return;
  }

  vscode.window.showInformationMessage(`Analizando idea: "${idea}"...`);

  try {
    const result = await orchestrator.analyze(idea);
    
    if (result.message) {
      vscode.window.showWarningMessage(result.message);
      return;
    }

    // Show dashboard with results
    const DashboardPanel = (await import('../panels/DashboardPanel')).DashboardPanel;
    DashboardPanel.render(
      vscode.Uri.file(__dirname).with({ scheme: 'vscode-file' }),
      result
    );

    vscode.window.showInformationMessage(
      `Análisis completado: ${result.files.length} archivos afectados.`
    );
  } catch (error) {
    vscode.window.showErrorMessage(`Error durante el análisis: ${(error as Error).message}`);
    console.error('analyzeIdea error:', error);
  }
}
