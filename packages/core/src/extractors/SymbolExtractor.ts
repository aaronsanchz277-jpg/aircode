import Parser from 'web-tree-sitter';
import { DatabaseManager } from '../storage/DatabaseManager';

interface ExtractedSymbol {
  name: string;
  kind: string;
  line_start: number;
  line_end: number;
  scope: string;
  docstring: string;
  snippet: string;
  complexity?: number;
}

export class SymbolExtractor {
  constructor(private db: DatabaseManager) {}

  async extractSymbols(
    fileId: number, 
    ast: Parser.Tree, 
    language: string,
    fileContent: string
  ): Promise<void> {
    try {
      const symbols: ExtractedSymbol[] = [];
      const cursor = ast.walk();
      const lines = fileContent.split('\n');

      const symbolKinds: Record<string, string> = {
        function_declaration: 'function',
        function_definition: 'function',
        method_definition: 'function',
        class_declaration: 'class',
        class_definition: 'class',
        variable_declaration: 'variable',
        lexical_declaration: 'variable',
        interface_declaration: 'interface',
        type_alias_declaration: 'type',
        enum_declaration: 'enum',
      };

      const visit = () => {
        const node = cursor.currentNode;
        const kind = symbolKinds[node.type];
        if (kind) {
          const nameNode = node.childForFieldName('name');
          if (nameNode) {
            const docstring = this.extractDocstring(node, language, fileContent, lines);
            const snippet = this.extractSnippet(node, fileContent, lines);
            const scope = this.determineScope(node, language);
            const complexity = this.calculateComplexity(node, language);
            
            symbols.push({
              name: nameNode.text,
              kind,
              line_start: node.startPosition.row,
              line_end: node.endPosition.row,
              scope,
              docstring,
              snippet,
              complexity,
            });
          }
        }
        if (cursor.gotoFirstChild()) {
          do { visit(); } while (cursor.gotoNextSibling());
          cursor.gotoParent();
        }
      };

      visit();

      for (const sym of symbols) {
        await this.db.execute(
          `INSERT INTO symbol (file_id, name, kind, line_start, line_end, scope, docstring, snippet, complexity)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [fileId, sym.name, sym.kind, sym.line_start, sym.line_end, sym.scope, sym.docstring, sym.snippet, sym.complexity ?? 1]
        );
      }
    } catch (error) {
      console.error(`Error extracting symbols for file ${fileId}:`, error);
    }
  }

  private extractDocstring(
    node: Parser.SyntaxNode,
    language: string,
    content: string,
    lines: string[]
  ): string {
    try {
      // Try to find docstring/comment before or inside the symbol
      if (language === 'python') {
        // Python docstrings are string literals as first child
        const firstChild = node.firstChild;
        if (firstChild && (firstChild.type === 'string' || firstChild.type === 'expression_statement')) {
          const stringNode = firstChild.type === 'string' ? firstChild : firstChild.firstChild;
          if (stringNode && stringNode.type === 'string') {
            return this.cleanString(stringNode.text);
          }
        }
      } else if (language === 'typescript' || language === 'tsx' || language === 'javascript') {
        // Look for JSDoc comment before the declaration
        const comment = this.findJSDocComment(node, lines);
        if (comment) {
          return comment;
        }
      }

      // Fallback: look for single-line comments above
      const inlineComment = this.findInlineComments(node, lines);
      return inlineComment;
    } catch (error) {
      console.error(`Error extracting docstring:`, error);
      return '';
    }
  }

  private findJSDocComment(node: Parser.SyntaxNode, lines: string[]): string {
    try {
      const startLine = node.startPosition.row;
      
      // Look backwards for JSDoc comment (/** ... */)
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
          // Hit non-comment content
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
      console.error(`Error finding JSDoc comment:`, error);
    }
    
    return '';
  }

  private findInlineComments(node: Parser.SyntaxNode, lines: string[]): string {
    try {
      const startLine = node.startPosition.row;
      
      // Look for single-line comments directly above
      for (let i = startLine - 1; i >= Math.max(0, startLine - 5); i--) {
        const line = lines[i].trim();
        if (line.startsWith('//')) {
          return line.replace(/^\/\/\s*/, '');
        } else if (line !== '') {
          break;
        }
      }
    } catch (error) {
      console.error(`Error finding inline comments:`, error);
    }
    
    return '';
  }

  private extractSnippet(
    node: Parser.SyntaxNode,
    content: string,
    lines: string[]
  ): string {
    try {
      const startOffset = node.startIndex;
      const endOffset = node.endIndex;
      
      // Limit snippet size
      const maxLines = 20;
      const snippetLines = lines.slice(node.startPosition.row, node.endPosition.row + 1);
      
      if (snippetLines.length > maxLines) {
        return snippetLines.slice(0, maxLines).join('\n') + '\n  // ...';
      }
      
      return snippetLines.join('\n');
    } catch (error) {
      console.error(`Error extracting snippet:`, error);
      return '';
    }
  }

  private determineScope(node: Parser.SyntaxNode, language: string): string {
    try {
      // Check if symbol is exported
      const parent = node.parent;
      if (parent) {
        if (parent.type === 'export_statement' || parent.type === 'export_clause') {
          return 'exported';
        }
      }
      
      // Check for export keyword in the node itself
      if (node.children.some(c => c.type === 'export' || c.text.includes('export'))) {
        return 'exported';
      }
      
      // Check if it's a private member (starts with _ or has private modifier)
      const nameNode = node.childForFieldName('name');
      if (nameNode && nameNode.text.startsWith('_')) {
        return 'private';
      }
      
      if (node.children.some(c => c.type === 'private' || c.text.includes('private'))) {
        return 'private';
      }
    } catch (error) {
      console.error(`Error determining scope:`, error);
    }
    
    return 'local';
  }

  private cleanString(text: string): string {
    try {
      // Remove quotes and triple quotes
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

  private calculateComplexity(node: Parser.SyntaxNode, language: string): number {
    const decisionTypes = new Set([
      'if_statement', 'for_statement', 'while_statement', 'do_statement',
      'case_clause', 'catch_clause', 'ternary_expression', 'switch_case',
      'elif_clause', 'except_clause', 'conditional_expression', 'boolean_operator'
    ]);
    
    let count = 0;
    const cursor = node.walk();
    
    const visit = () => {
      const curr = cursor.currentNode;
      if (decisionTypes.has(curr.type)) {
        count++;
      } else if (curr.type === 'binary_expression') {
        const op = curr.childForFieldName('operator');
        if (op && ['&&', '||', 'and', 'or'].includes(op.text)) {
          count++;
        }
      }
      if (cursor.gotoFirstChild()) {
        do { visit(); } while (cursor.gotoNextSibling());
        cursor.gotoParent();
      }
    };
    
    visit();
    return 1 + count;
  }
}
