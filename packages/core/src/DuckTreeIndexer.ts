import { DatabaseManager } from './storage/DatabaseManager';
import { detectLanguage } from './parser/detectLanguage';
import { createParser } from './parser/treeSitterLoader';
import { SymbolExtractor } from './extractors/SymbolExtractor';
import { EdgeExtractor } from './extractors/EdgeExtractor';
import { DocstringExtractor } from './extractors/DocstringExtractor';
import { classifyFile } from './classifier/ArchitectureClassifier';
import fs from 'fs/promises';
import crypto from 'crypto';

export class DuckTreeIndexer {
  private symbolExtractor: SymbolExtractor;
  private edgeExtractor: EdgeExtractor;
  private docstringExtractor: DocstringExtractor;

  constructor(private db: DatabaseManager) {
    this.symbolExtractor = new SymbolExtractor(db);
    this.edgeExtractor = new EdgeExtractor(db);
    this.docstringExtractor = new DocstringExtractor(db);
  }

  async indexFile(absolutePath: string, workspaceRoot: string): Promise<void> {
    const language = detectLanguage(absolutePath);
    if (!language) return;

    const relativePath = absolutePath.replace(workspaceRoot, '').replace(/^[/\\]/, '');
    const content = await fs.readFile(absolutePath, 'utf-8');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    const layer = classifyFile(relativePath);
    const lastModified = (await fs.stat(absolutePath)).mtimeMs;

    // Upsert file
    const existing = await this.db.execute('SELECT id FROM file WHERE path = ?', [relativePath]);
    let fileId: number;

    if (existing.length > 0) {
      fileId = existing[0].id as number;
      await this.db.execute(
        `UPDATE file SET hash=?, last_modified=?, layer=?, language=? WHERE id=?`,
        [hash, lastModified, layer, language, fileId]
      );
      await this.db.execute('DELETE FROM symbol WHERE file_id=?', [fileId]);
    } else {
      await this.db.execute(
        `INSERT INTO file (path, absolute_path, hash, language, layer, last_modified)
         VALUES (?,?,?,?,?,?)`,
        [relativePath, absolutePath, hash, language, layer, lastModified]
      );
      const idRow = await this.db.execute('SELECT id FROM file WHERE path=?', [relativePath]);
      fileId = idRow[0].id as number;
    }

    const parser = await createParser(language);
    const tree = parser.parse(content);
    
    // Extract symbols with content for snippets and docstrings
    await this.symbolExtractor.extractSymbols(fileId, tree, language, content);
    
    // Enhance docstrings
    await this.docstringExtractor.extractAndUpdate(fileId, tree, language, content);
  }

  async indexWorkspace(workspaceRoot: string): Promise<void> {
    const walk = async (dir: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = `${dir}/${entry.name}`;
        if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
          await walk(full);
        } else if (entry.isFile()) {
          await this.indexFile(full, workspaceRoot);
        }
      }
    };

    await walk(workspaceRoot);

    // After all symbols are indexed, extract edges
    const files = await this.db.execute('SELECT id, path, absolute_path, language FROM file');
    for (const f of files) {
      if (!f.language) continue;
      try {
        const content = await fs.readFile(f.absolute_path as string, 'utf-8');
        const parser = await createParser(f.language as string);
        const tree = parser.parse(content);
        await this.edgeExtractor.extractEdges(
          f.id as number,
          tree,
          f.language as string,
          f.path as string,
          content
        );
      } catch (error) {
        console.error(`Error processing edges for ${f.path}:`, error);
      }
    }
  }
}
