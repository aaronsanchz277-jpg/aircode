import * as vscode from 'vscode';
import { AnalysisResult } from '../services/AnalysisOrchestrator';

export class DashboardPanel {
  public static currentPanel: DashboardPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;

  private constructor(panel: vscode.WebviewPanel, private _extensionUri: vscode.Uri) {
    this._panel = panel;
    this._panel.onDidDispose(() => DashboardPanel.currentPanel = undefined, null, []);
  }

  public static render(extensionUri: vscode.Uri, result: AnalysisResult): void {
    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
      DashboardPanel.currentPanel._panel.webview.postMessage({ command: 'updateAnalysis', data: result });
    } else {
      const panel = vscode.window.createWebviewPanel(
        'aircodeDashboard',
        'AIR-Code Dashboard',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
        }
      );
      DashboardPanel.currentPanel = new DashboardPanel(panel, extensionUri);

      panel.webview.html = getWebviewContent(panel.webview, extensionUri);

      panel.webview.onDidReceiveMessage(
        (message) => {
          switch (message.command) {
            case 'explainWithAI':
              break;
            case 'openFile':
              break;
          }
        },
        undefined,
        []
      );

      panel.webview.postMessage({ command: 'updateAnalysis', data: result });
    }
  }
}

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'webview.js'));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'webview.css'));

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>AIR-Code Dashboard</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div id="root"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
}
