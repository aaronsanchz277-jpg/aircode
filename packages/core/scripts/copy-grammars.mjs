import { copyFile, mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NEEDED = [
  'tree-sitter-typescript.wasm',
  'tree-sitter-tsx.wasm',
  'tree-sitter-javascript.wasm',
  'tree-sitter-python.wasm',
];

const SRC_DIR = path.resolve(__dirname, '../node_modules/tree-sitter-wasms/out');
const DEST_DIR = path.resolve(__dirname, '../grammars');

await mkdir(DEST_DIR, { recursive: true });

for (const file of NEEDED) {
  await copyFile(path.join(SRC_DIR, file), path.join(DEST_DIR, file));
}

await copyFile(
  path.resolve(__dirname, '../node_modules/web-tree-sitter/tree-sitter.wasm'),
  path.join(DEST_DIR, 'tree-sitter.wasm')
);

console.log('✅ Gramáticas copiadas a grammars/');
