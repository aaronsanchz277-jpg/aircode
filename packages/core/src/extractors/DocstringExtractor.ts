import Parser from 'web-tree-sitter';
import { DatabaseManager } from '../storage/DatabaseManager';

export class DocstringExtractor {
  constructor(private db: DatabaseManager) {}
  async extractAndUpdate(fileId: number, ast: Parser.Tree, language: string): Promise<void> {
    // Placeholder para futura mejora
  }
}
