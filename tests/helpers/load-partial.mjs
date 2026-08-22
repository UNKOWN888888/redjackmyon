import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');

export function loadPartial(fileName, sandbox = {}) {
  const source = fs.readFileSync(path.join(root, 'src', 'partials', fileName), 'utf8');
  const context = {
    console,
    ...sandbox,
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: fileName });
  return context;
}
