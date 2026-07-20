import Parser from 'web-tree-sitter';
import { DatabaseManager } from '../storage/DatabaseManager';
import path from 'path';

interface ImportInfo {
  modulePath: string;
  importedNames: string[];
  isWildcard: boolean;
  startLine: number;
}

export class EdgeExtractor {
  constructor(private db: DatabaseManager) {}
  
  async extractEdges(
    fileId: number,
    ast: Parser.Tree,
    language: string,
    filePath: string,
    fileContent: string
  ): Promise<void> {
    try {
      const imports = this.extractImports(ast, language, filePath, fileContent);
      
      // Create a cache for symbol lookups to avoid O(n²) queries
      const symbolCache = new Map<number, Array<{ id: number; name: string }>>();
      
      for (const imp of imports) {
        const targetFileIds = await this.findTargetFiles(imp.modulePath);
        
        for (const targetFileId of targetFileIds) {
          // Only create edges between symbols that are actually related
          const connections = await this.findSymbolConnections(
            fileId,
            targetFileId,
            imp,
            symbolCache
          );
          
          for (const conn of connections) {
            if (conn.fromId > 0 && conn.toId > 0) {
              await this.db.execute(
                `INSERT OR IGNORE INTO edge (from_symbol_id, to_symbol_id, kind, is_precise) 
                 VALUES (?, ?, ?, ?)`,
                [conn.fromId, conn.toId, conn.kind, conn.isPrecise]
              );
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error extracting edges for file ${filePath}:`, error);
    }
  }
  
  private extractImports(
    ast: Parser.Tree,
    language: string,
    filePath: string,
    content: string
  ): ImportInfo[] {
    const imports: ImportInfo[] = [];
    const cursor = ast.walk();
    const lines = content.split('\n');

    const visit = () => {
      const node = cursor.currentNode;
      
      if (this.isImportNode(node.type, language)) {
        const importInfo = this.parseImportNode(node, language, filePath, lines);
        if (importInfo) {
          imports.push(importInfo);
        }
      }
      
      if (cursor.gotoFirstChild()) {
        do { visit(); } while (cursor.gotoNextSibling());
        cursor.gotoParent();
      }
    };

    visit();
    return imports;
  }
  
  private isImportNode(nodeType: string, language: string): boolean {
    const importTypes: Record<string, string[]> = {
      typescript: ['import_statement', 'import_clause'],
      tsx: ['import_statement', 'import_clause'],
      javascript: ['import_statement', 'import_clause'],
      python: ['import_statement', 'import_from_statement'],
    };
    const types = importTypes[language] || importTypes.typescript;
    return types.includes(nodeType);
  }
  
  private parseImportNode(
    node: Parser.SyntaxNode,
    language: string,
    filePath: string,
    lines: string[]
  ): ImportInfo | null {
    let modulePath = '';
    const importedNames: string[] = [];
    let isWildcard = false;
    
    if (language === 'python') {
      if (node.type === 'import_from_statement') {
        const sourceNode = node.childForFieldName('module_name');
        if (sourceNode) {
          modulePath = sourceNode.text;
        }
        
        const namesNode = node.childForFieldName('name');
        if (namesNode) {
          if (namesNode.type === 'wildcard_import') {
            isWildcard = true;
          } else {
            importedNames.push(namesNode.text);
          }
        }
        
        // Check for aliases and multiple imports
        const aliasNodes = node.children.filter(c => c.type === 'aliased_import');
        for (const alias of aliasNodes) {
          const nameNode = alias.childForFieldName('name');
          if (nameNode) {
            importedNames.push(nameNode.text);
          }
        }
      } else if (node.type === 'import_statement') {
        const dottedNames = node.children.filter(c => c.type === 'dotted_name');
        for (const dotted of dottedNames) {
          const parts = dotted.children.filter(c => c.type === 'identifier');
          if (parts.length > 0) {
            modulePath = parts.map(p => p.text).join('.');
            const lastName = parts[parts.length - 1];
            if (lastName) {
              importedNames.push(lastName.text);
            }
          }
        }
      }
    } else {
      // JavaScript/TypeScript
      const sourceNode = node.childForFieldName('source');
      if (sourceNode) {
        modulePath = sourceNode.text.replace(/['"]/g, '');
      }
      
      const specifier = node.childForFieldName('name') || node.childForFieldName('namespace');
      if (specifier) {
        if (specifier.type === 'namespace_import') {
          const nameNode = specifier.childForFieldName('name');
          if (nameNode) {
            importedNames.push(nameNode.text);
          }
        } else if (specifier.type === 'named_imports') {
          const specifiers = specifier.children.filter(c => c.type === 'import_specifier');
          for (const spec of specifiers) {
            const nameNode = spec.childForFieldName('name') || spec.firstNamedChild;
            if (nameNode) {
              importedNames.push(nameNode.text);
            }
          }
        } else if (specifier.type === 'identifier') {
          importedNames.push(specifier.text);
        }
      }
      
      // Check for wildcard import
      if (node.text.includes('*')) {
        isWildcard = true;
      }
    }
    
    if (!modulePath) return null;
    
    // Resolve relative paths
    if (modulePath.startsWith('.')) {
      const dir = path.dirname(filePath);
      modulePath = path.normalize(path.join(dir, modulePath));
    }
    
    return {
      modulePath,
      importedNames,
      isWildcard,
      startLine: node.startPosition.row,
    };
  }
  
  private async findTargetFiles(modulePath: string): Promise<number[]> {
    try {
      const rows = await this.db.execute(
        `SELECT id FROM file WHERE absolute_path LIKE ? OR path LIKE ? 
         LIMIT 50`,
        [`%${modulePath}%`]
      );
      return rows.map(r => r.id as number);
    } catch (error) {
      console.error(`Error finding target files for ${modulePath}:`, error);
      return [];
    }
  }
  
  private async findSymbolConnections(
    sourceFileId: number,
    targetFileId: number,
    importInfo: ImportInfo,
    cache: Map<number, Array<{ id: number; name: string }>>
  ): Promise<Array<{ fromId: number; toId: number; kind: string; isPrecise: boolean }>> {
    const connections: Array<{ fromId: number; toId: number; kind: string; isPrecise: boolean }> = [];
    
    try {
      // Get source symbols from cache or database
      let sourceSymbols = cache.get(sourceFileId);
      if (!sourceSymbols) {
        const rows = await this.db.execute(
          `SELECT id, name FROM symbol WHERE file_id = ?`,
          [sourceFileId]
        );
        sourceSymbols = rows.map(r => ({ id: r.id as number, name: r.name as string }));
        cache.set(sourceFileId, sourceSymbols);
      }
      
      // Get target symbols
      let targetSymbols = cache.get(targetFileId);
      if (!targetSymbols) {
        const rows = await this.db.execute(
          `SELECT id, name FROM symbol WHERE file_id = ?`,
          [targetFileId]
        );
        targetSymbols = rows.map(r => ({ id: r.id as number, name: r.name as string }));
        cache.set(targetFileId, targetSymbols);
      }
      
      // If wildcard import, connect only exported public symbols (avoid O(n²))
      if (importInfo.isWildcard) {
        const exportedTargets = targetSymbols.filter(s => 
          !s.name.startsWith('_')
        ).slice(0, 20); // Limit to prevent explosion
        
        for (const targetSym of exportedTargets) {
          connections.push({
            fromId: sourceSymbols[0]?.id || 0,
            toId: targetSym.id,
            kind: 'imports_wildcard',
            isPrecise: false,
          });
        }
        return connections;
      }
      
      // Match specific imported names
      if (importInfo.importedNames.length > 0) {
        const matchedTargets = targetSymbols.filter(s =>
          importInfo.importedNames.some(name => 
            s.name === name || s.name.endsWith(`.${name}`)
          )
        );
        
        for (const targetSym of matchedTargets) {
          const sourceSym = sourceSymbols.find(s => s.name === importInfo.importedNames[0]);
          if (sourceSym) {
            connections.push({
              fromId: sourceSym.id,
              toId: targetSym.id,
              kind: 'imports_specific',
              isPrecise: true,
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error finding symbol connections:`, error);
    }
    
    return connections;
  }
}
