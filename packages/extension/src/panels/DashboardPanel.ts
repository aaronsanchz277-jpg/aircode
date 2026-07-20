import * as vscode from 'vscode';
import { AnalysisResult } from '../services/AnalysisOrchestrator';
import { explainWithAI } from '../commands/explainWithAI';

export class DashboardPanel {
  public static currentPanel: DashboardPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, private _extensionUri: vscode.Uri) {
    this._panel = panel;
    this._disposables.push(
      panel.onDidDispose(() => this.dispose(), null, [])
    );
  }

  public static render(extensionUri: vscode.Uri, result: AnalysisResult): void {
    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
      DashboardPanel.currentPanel._panel.webview.postMessage({ 
        command: 'updateAnalysis', 
        data: result 
      });
    } else {
      const panel = vscode.window.createWebviewPanel(
        'aircodeDashboard',
        'AIR-Code Dashboard',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
        }
      );
      
      DashboardPanel.currentPanel = new DashboardPanel(panel, extensionUri);
      panel.webview.html = getWebviewContent(panel.webview, extensionUri, result);

      panel.webview.onDidReceiveMessage(
        async (message) => {
          switch (message.command) {
            case 'explainWithAI':
              await explainWithAI(message.idea, message.files);
              break;
            case 'openFile':
              await openFile(message.filePath);
              break;
            case 'reindexFile':
              // Trigger reindex for specific file
              break;
          }
        },
        undefined,
        DashboardPanel.currentPanel['_disposables']
      );

      panel.webview.postMessage({ command: 'updateAnalysis', data: result });
    }
  }

  private dispose() {
    DashboardPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) x.dispose();
    }
  }
}

async function openFile(filePath: string): Promise<void> {
  try {
    const uri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
  } catch (error) {
    vscode.window.showErrorMessage(`No se pudo abrir el archivo: ${filePath}`);
  }
}

function getWebviewContent(
  webview: vscode.Webview, 
  extensionUri: vscode.Uri,
  result: AnalysisResult
): string {
  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' https://cdn.jsdelivr.net; connect-src https://api.openai.com;">
  <title>AIR-Code Dashboard</title>
  <style>
    :root {
      --primary: #2563eb;
      --success: #22c55e;
      --warning: #f59e0b;
      --danger: #ef4444;
      --bg: #f9fafb;
      --card-bg: #ffffff;
      --text: #1f2937;
      --text-muted: #6b7280;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 20px;
      margin: 0;
    }
    h1, h2 { color: var(--primary); }
    .card {
      background: var(--card-bg);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .btn {
      background: var(--primary);
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
    }
    .btn:hover { opacity: 0.9; }
    .btn-secondary {
      background: #6b7280;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      text-align: left;
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    th { background: #f3f4f6; }
    .risk-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }
    .risk-low { background: #dcfce7; color: #166534; }
    .risk-medium { background: #fef3c7; color: #92400e; }
    .risk-high { background: #fee2e2; color: #991b1b; }
    #graph-container { margin-top: 20px; }
  </style>
</head>
<body>
  <h1>AIR-Code Dashboard</h1>
  
  <div class="card">
    <h2>Idea Analizada</h2>
    <p id="idea-text">${escapeHtml(result.idea)}</p>
    <button class="btn" id="explain-btn">Explicar con IA</button>
  </div>

  ${result.message ? `
    <div class="card" style="background: #fef3c7;">
      <p>${escapeHtml(result.message)}</p>
    </div>
  ` : ''}

  <div class="card">
    <h2>Archivos Afectados (${result.files.length})</h2>
    <table id="files-table">
      <thead>
        <tr>
          <th>Archivo</th>
          <th>Capa</th>
          <th>Riesgo</th>
          <th>Fan-Out</th>
          <th>Commits</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${result.files.map(f => `
          <tr>
            <td>${escapeHtml(f.path)}</td>
            <td>${escapeHtml(f.layer)}</td>
            <td><span class="risk-badge ${getRiskClass(f.risk)}">${f.risk}</span></td>
            <td>${f.fanOut}</td>
            <td>${f.commits}</td>
            <td>
              <button class="btn btn-secondary open-file" data-path="${escapeHtml(f.path)}">Abrir</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="card" id="graph-container">
    <h2>Gráfico de Dependencias</h2>
    <div id="force-graph"></div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const filesData = ${JSON.stringify(result.files)};
    const graphData = ${JSON.stringify(result.graph)};
    const idea = ${JSON.stringify(result.idea)};

    document.getElementById('explain-btn').addEventListener('click', () => {
      vscode.postMessage({ command: 'explainWithAI', idea, files: filesData });
    });

    document.querySelectorAll('.open-file').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const path = e.target.dataset.path;
        vscode.postMessage({ command: 'openFile', filePath: path });
      });
    });

    // Render graph placeholder (can be enhanced with D3)
    const graphContainer = document.getElementById('force-graph');
    graphContainer.innerHTML = '<p>Nodos: ' + graphData.nodes.length + ', Aristas: ' + graphData.edges.length + '</p>';

    window.addEventListener('message', event => {
      const message = event.data;
      if (message.command === 'updateAnalysis') {
        console.log('Analysis updated:', message.data);
      }
    });
  </script>
</body>
</html>`;
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getRiskClass(risk: number): string {
  if (risk < 40) return 'risk-low';
  if (risk < 70) return 'risk-medium';
  return 'risk-high';
}
