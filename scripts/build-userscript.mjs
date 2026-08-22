#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const args = process.argv.slice(2);

function readArg(name, fallback) {
  const prefix = `${name}=`;
  const inline = args.find(arg => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  return fallback;
}

const metaPath = path.join(root, 'src', 'userscript.meta.js');
const partialDir = path.join(root, 'src', 'partials');
const distPath = readArg('--out', path.join(root, 'dist', 'blackjackT.user.js'));
function getDefaultInstallPath() {
  if (process.env.BLACKJACKT_INSTALL_PATH) return process.env.BLACKJACKT_INSTALL_PATH;
  if (process.platform === 'win32') {
    return path.join(process.env.USERPROFILE || process.env.HOME || 'C:/Users/kakao', 'Downloads', 'blackjackT.txt');
  }
  return '/mnt/c/Users/kakao/Downloads/blackjackT.txt';
}

const installPath = readArg('--install-path', getDefaultInstallPath());
const shouldInstall = args.includes('--install');

const meta = fs.readFileSync(metaPath, 'utf8').replace(/\r\n/g, '\n').trimEnd();
const partialFiles = fs.readdirSync(partialDir)
  .filter(file => file.endsWith('.js'))
  .sort((a, b) => a.localeCompare(b, 'en'));

if (partialFiles.length === 0) {
  throw new Error(`No partials found in ${partialDir}`);
}

let output = `${meta}\n\n(function() {\n`;
for (const file of partialFiles) {
  const source = fs.readFileSync(path.join(partialDir, file), 'utf8')
    .replace(/\r\n/g, '\n')
    .trimEnd();
  output += `${source}\n\n`;
}
output += '})();\n';

fs.mkdirSync(path.dirname(distPath), { recursive: true });
fs.writeFileSync(distPath, output);
console.log(`Built ${path.relative(root, distPath)} from ${partialFiles.length} partials`);

if (shouldInstall) {
  fs.mkdirSync(path.dirname(installPath), { recursive: true });
  fs.writeFileSync(installPath, output);
  console.log(`Installed ${installPath}`);
}
