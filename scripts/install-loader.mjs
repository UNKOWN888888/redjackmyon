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

function getDefaultInstallPath() {
  if (process.env.BLACKJACKT_LOADER_INSTALL_PATH) return process.env.BLACKJACKT_LOADER_INSTALL_PATH;
  if (process.platform === 'win32') {
    return path.join(
      process.env.USERPROFILE || process.env.HOME || 'C:/Users/kakao',
      'Downloads',
      'blackjackT-loader.user.js',
    );
  }
  return '/mnt/c/Users/kakao/Downloads/blackjackT-loader.user.js';
}

const sourcePath = path.join(root, 'loader', 'blackjackT-loader.user.js');
const installPath = readArg('--install-path', getDefaultInstallPath());
const source = fs.readFileSync(sourcePath, 'utf8').replace(/\r\n/g, '\n');

fs.mkdirSync(path.dirname(installPath), { recursive: true });
fs.writeFileSync(installPath, source, 'utf8');
console.log(`Installed GitHub loader ${installPath}`);
