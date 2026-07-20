import Parser from 'web-tree-sitter';
import { DatabaseManager } from '../storage/DatabaseManager';

/**
 * Extractor especializado para mejorar docstrings existentes
 * o generar descripciones basadas en el código
 */
export class DocstringExtractor {
  constructor(private db: DatabaseManager) {}
  
  async extractAndUpdate(
    fileId: number, 
    ast: Parser.Tree, 
    language: string,
    fileContent: string
  ): Promise<void> {
    try {
      const updates: Array<{ symbolId: number; docstring: string }> = [];
      const cursor = ast.walk();
      const lines = fileContent.split('\n');

      // Mapear símbolos existentes con sus nodos AST
      const existingSymbols = await this.db.execute(
        `SELECT id, name, line_start FROM symbol WHERE file_id = ?`,
        [fileId]
      );
      
      const symbolMap = new Map<number, { id: number; name: string; line_start: number }>();
      for (const sym of existingSymbols) {
        symbolMap.set(sym.line_start as number, {
          id: sym.id as number,
          name: sym.name as string,
          line_start: sym.line_start as number,
        });
      }

      const visit = () => {
        const node = cursor.currentNode;
        
        if (this.isSymbolNode(node.type)) {
          const nameNode = node.childForFieldName('name');
          if (nameNode) {
            const startLine = node.startPosition.row;
            const existing = symbolMap.get(startLine);
            
            if (existing) {
              const currentDocstring = this.extractDocstring(node, language, lines);
              
              // Solo actualizar si encontramos un docstring mejor
              if (currentDocstring && currentDocstring.length > 0) {
                updates.push({
                  symbolId: existing.id,
                  docstring: currentDocstring,
                });
              }
            }
          }
        }
        
        if (cursor.gotoFirstChild()) {
          do { visit(); } while (cursor.gotoNextSibling());
          cursor.gotoParent();
        }
      };

      visit();

      // Aplicar actualizaciones en batch
      for (const update of updates) {
        await this.db.execute(
          `UPDATE symbol SET docstring = ? WHERE id = ?`,
          [update.docstring, update.symbolId]
        );
      }
    } catch (error) {
      console.error(`Error updating docstrings for file ${fileId}:`, error);
    }
  }

  private isSymbolNode(nodeType: string): boolean {
    const symbolTypes = [
      'function_declaration',
      'function_definition',
      'method_definition',
      'class_declaration',
      'class_definition',
      'interface_declaration',
      'type_alias_declaration',
    ];
    return symbolTypes.includes(nodeType);
  }

  private extractDocstring(
    node: Parser.SyntaxNode,
    language: string,
    lines: string[]
  ): string {
    try {
      if (language === 'python') {
        return this.extractPythonDocstring(node, lines);
      } else if (['typescript', 'tsx', 'javascript'].includes(language)) {
        return this.extractJSDoc(node, lines);
      }
    } catch (error) {
      console.error(`Error extracting docstring:`, error);
    }
    return '';
  }

  private extractPythonDocstring(node: Parser.SyntaxNode, lines: string[]): string {
    try {
      const body = node.childForFieldName('body');
      if (!body) return '';
      
      const firstStmt = body.firstChild;
      if (firstStmt && firstStmt.type === 'expression_statement') {
        const stringNode = firstStmt.firstChild;
        if (stringNode && stringNode.type === 'string') {
          return this.cleanString(stringNode.text);
        }
      }
    } catch (error) {
      console.error(`Error extracting Python docstring:`, error);
    }
    return '';
  }

  private extractJSDoc(node: Parser.SyntaxNode, lines: string[]): string {
    try {
      const startLine = node.startPosition.row;
      let jsdocStart = -1;
      let jsdocEnd = -1;
      
      for (let i = startLine - 1; i >= Math.max(0, startLine - 50); i--) {
        const line = lines[i].trim();
        if (line.endsWith('*/')) {
          jsdocEnd = i;
        } else if (jsdocEnd !== -1 && line.startsWith('/**')) {
          jsdocStart = i;
          break;
        } else if (line !== '' && !line.startsWith('*') && !line.startsWith('//')) {
          break;
        }
      }
      
      if (jsdocStart !== -1 && jsdocEnd !== -1) {
        const commentLines = lines.slice(jsdocStart, jsdocEnd + 1);
        return commentLines
          .map(l => l.replace(/^\s*\*\s?/, '').replace(/^\s*\/\*\*?\s?/, '').replace(/\s*\/$/, ''))
          .join('\n')
          .trim();
      }
    } catch (error) {
      console.error(`Error extracting JSDoc:`, error);
    }
    return '';
  }

  private cleanString(text: string): string {
    try {
      return text
        .replace(/^['"`]{3}/, '')
        .replace(/['"`]{3}$/, '')
        .replace(/^['"`]/, '')
        .replace(/['"`]$/, '')
        .trim();
    } catch (error) {
      console.error(`Error cleaning string:`, error);
      return '';
    }
  }
}
