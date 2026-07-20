import * as vscode from 'vscode';

export class AIService {
  private apiKey: string | undefined;
  private apiEndpoint: string = 'https://api.openai.com/v1/chat/completions';

  constructor() {
    const config = vscode.workspace.getConfiguration('aircode');
    this.apiKey = config.get('openaiApiKey');
    this.apiEndpoint = config.get('apiEndpoint') || this.apiEndpoint;
  }

  async explain(idea: string, files: Array<{ path: string; snippet: string; risk: number }>): Promise<string> {
    if (!this.apiKey) {
      return 'Configuración requerida: establece tu API key de OpenAI en la configuración de AIR-Code (aircode.openaiApiKey).';
    }

    try {
      const prompt = this.buildPrompt(idea, files);
      
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Eres un asistente experto en análisis de código. Explica de manera clara y concisa el impacto de los cambios propuestos.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 1000,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      return data.choices[0].message.content || 'No se pudo generar una explicación.';
    } catch (error) {
      console.error('AIService error:', error);
      return `Error al obtener explicación con IA: ${(error as Error).message}`;
    }
  }

  private buildPrompt(idea: string, files: Array<{ path: string; snippet: string; risk: number }>): string {
    let prompt = `Analiza el siguiente impacto de cambio en el código:\n\n`;
    prompt += `**Idea:** ${idea}\n\n`;
    prompt += `**Archivos afectados (${files.length}):**\n\n`;

    for (const file of files.slice(0, 10)) {
      prompt += `### ${file.path}\n`;
      prompt += `Riesgo: ${file.risk}/100\n`;
      prompt += `\`\`\`\n${file.snippet.substring(0, 500)}\n\`\`\`\n\n`;
    }

    prompt += `Por favor explica:\n`;
    prompt += `1. ¿Qué áreas del sistema se ven afectadas?\n`;
    prompt += `2. ¿Cuáles son los riesgos principales?\n`;
    prompt += `3. ¿Hay dependencias críticas a considerar?\n`;
    prompt += `4. Recomendaciones para implementar este cambio de manera segura.`;

    return prompt;
  }
}
