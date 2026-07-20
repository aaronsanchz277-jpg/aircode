import * as vscode from 'vscode';
import { AIService } from '../services/AIService';

export async function explainWithAI(
  idea: string,
  files: Array<{ path: string; snippet: string; risk: number }>
): Promise<void> {
  if (!files.length) {
    vscode.window.showWarningMessage('No hay archivos para explicar.');
    return;
  }

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Generando explicación con IA...',
        cancellable: true,
      },
      async (progress, token) => {
        const aiService = new AIService();
        
        const explanation = await aiService.explain(idea, files);
        
        // Show explanation in a new panel
        const panel = vscode.window.createWebviewPanel(
          'aircodeExplanation',
          'Explicación AIR-Code',
          vscode.ViewColumn.One,
          { enableScripts: true }
        );

        panel.webview.html = getHtmlContent(explanation);

        progress.report({ increment: 100 });
      }
    );
  } catch (error) {
    vscode.window.showErrorMessage(`Error al generar explicación: ${(error as Error).message}`);
    console.error('explainWithAI error:', error);
  }
}

function getHtmlContent(explanation: string): string {
  const markedScript = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
  
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Explicación AIR-Code</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      padding: 20px;
      color: #333;
      max-width: 900px;
      margin: 0 auto;
    }
    h1, h2, h3 { color: #2563eb; }
    code { 
      background: #f3f4f6; 
      padding: 2px 6px; 
      border-radius: 4px;
      font-family: 'Consolas', 'Monaco', monospace;
    }
    pre { 
      background: #1e1e1e; 
      color: #d4d4d4;
      padding: 16px; 
      border-radius: 8px;
      overflow-x: auto;
    }
    pre code { 
      background: transparent; 
      padding: 0;
      color: inherit;
    }
    blockquote {
      border-left: 4px solid #2563eb;
      margin: 0;
      padding-left: 16px;
      color: #6b7280;
    }
  </style>
  <script src="${markedScript}"></script>
</head>
<body>
  <div id="content"></div>
  <script>
    const explanation = ${JSON.stringify(explanation)};
    document.getElementById('content').innerHTML = marked.parse(explanation);
  </script>
</body>
</html>`;
}
