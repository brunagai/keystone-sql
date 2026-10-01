// Copia o binário WebAssembly do sql.js para public/, de onde o Vite o serve
// na raiz do site (ex.: http://localhost:5173/sql-wasm.wasm).
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
const targetDir = resolve(root, 'public');
const target = resolve(targetDir, 'sql-wasm.wasm');

if (!existsSync(source)) {
  console.warn('[copy-wasm] sql.js ainda não instalado; execute "npm install".');
  process.exit(0);
}

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, target);
console.log('[copy-wasm] sql-wasm.wasm copiado para public/');
