import Parser from 'web-tree-sitter';
import fs from 'fs/promises';
import path from 'path';

const GRAMMARS_DIR = path.join(__dirname, '../../grammars');

const WASM_FILES: Record<string, string> = {
  typescript: 'tree-sitter-typescript.wasm',
  tsx: 'tree-sitter-tsx.wasm',
  javascript: 'tree-sitter-javascript.wasm',
  python: 'tree-sitter-python.wasm',
};

let initialized = false;
const loadedLanguages: Record<string, Parser.Language> = {};

async function ensureInit(): Promise<void> {
  if (initialized) return;
  await Parser.init({
    locateFile(scriptName: string) {
      return path.join(GRAMMARS_DIR, scriptName);
    },
  });
  initialized = true;
}

export async function loadLanguage(lang: string): Promise<Parser.Language> {
  await ensureInit();
  if (!loadedLanguages[lang]) {
    const fileName = WASM_FILES[lang];
    if (!fileName) throw new Error(`No hay gramática configurada para: ${lang}`);
    const wasmBytes = await fs.readFile(path.join(GRAMMARS_DIR, fileName));
    loadedLanguages[lang] = await Parser.Language.load(wasmBytes);
  }
  return loadedLanguages[lang];
}

export async function createParser(lang: string): Promise<Parser> {
  const language = await loadLanguage(lang);
  const parser = new Parser();
  parser.setLanguage(language);
  return parser;
}
