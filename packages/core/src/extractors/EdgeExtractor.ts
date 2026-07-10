import Parser from 'web-tree-sitter';
import { DatabaseManager } from '../storage/DatabaseManager';
import path from 'path';

export class EdgeExtractor {
  constructor(private db: DatabaseManager) {}

  async extractEdges(
    fileId: number,
    ast: Parser.Tree,
    language: string,
    filePath: string
  ): Promise<void> {
    const imports: string[] = [];
    const cursor = ast.walk();

    const visit = () => {
      const node = cursor.currentNode;
      if (node.type === 'import_statement' || node.type === 'import_from_statement') {
        const sourceNode = node.childForFieldName('source');
        if (sourceNode) {
          let modulePath = sourceNode.text.replace(/['"]/g, '');
          if (modulePath.startsWith('.')) {
            const dir = path.dirname(filePath);
            modulePath = path.normalize(path.join(dir, modulePath));
          }
          imports.push(modulePath);
        }
      }
      if (cursor.gotoFirstChild()) {
        do { visit(); } while (cursor.gotoNextSibling());
        cursor.gotoParent();
      }
    };

    visit();

    for (const imp of imports) {
      const rows = await this.db.execute(
        `SELECT id FROM file WHERE absolute_path LIKE ? OR path LIKE ?`,
        [`%${imp}%`, `%${imp}%`]
      );
      for (const row of rows) {
        const targetFileId = row.id as number;
        const sourceSyms = await this.db.execute(`SELECT id FROM symbol WHERE file_id = ?`, [fileId]);
        const targetSyms = await this.db.execute(`SELECT id FROM symbol WHERE file_id = ?`, [targetFileId]);
        for (const s of sourceSyms) {
          for (const t of targetSyms) {
            await this.db.execute(
              `INSERT INTO edge (from_symbol_id, to_symbol_id, kind) VALUES (?, ?, 'imports')`,
              [s.id, t.id]
            );
          }
        }
      }
    }
  }
}
