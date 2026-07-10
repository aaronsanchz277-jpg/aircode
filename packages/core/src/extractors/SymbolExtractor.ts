import Parser from 'web-tree-sitter';
import { DatabaseManager } from '../storage/DatabaseManager';

interface ExtractedSymbol {
  name: string;
  kind: string;
  line_start: number;
  line_end: number;
  scope: string;
  docstring: string;
}

export class SymbolExtractor {
  constructor(private db: DatabaseManager) {}

  async extractSymbols(fileId: number, ast: Parser.Tree, language: string): Promise<void> {
    const symbols: ExtractedSymbol[] = [];
    const cursor = ast.walk();

    const symbolKinds: Record<string, string> = {
      function_declaration: 'function',
      function_definition: 'function',
      method_definition: 'function',
      class_declaration: 'class',
      class_definition: 'class',
      variable_declaration: 'variable',
      lexical_declaration: 'variable',
    };

    const visit = () => {
      const node = cursor.currentNode;
      const kind = symbolKinds[node.type];
      if (kind) {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          symbols.push({
            name: nameNode.text,
            kind,
            line_start: node.startPosition.row,
            line_end: node.endPosition.row,
            scope: 'exported',
            docstring: '',
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
        `INSERT INTO symbol (file_id, name, kind, line_start, line_end, scope, docstring)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [fileId, sym.name, sym.kind, sym.line_start, sym.line_end, sym.scope, sym.docstring]
      );
    }
  }
}
