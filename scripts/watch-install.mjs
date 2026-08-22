#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const watchedFiles = [
  path.join(root, 'src', 'userscript.meta.js'),
  ...fs.readdirSync(path.join(root, 'src', 'partials'))
    .filter(file => file.endsWith('.js'))
    .sort((a, b) => a.localeCompare(b, 'en'))
    .map(file => path.join(root, 'src', 'partials', file)),
];

let timer = null;
let running = false;
let rerun = false;

function runInstall(reason) {
  if (running) {
    rerun = true;
    return;
  }
  running = true;
  rerun = false;
  console.log(`[watch] ${reason}: rebuilding Tampermonkey file`);
  const child = spawn(process.execPath, ['scripts/build-userscript.mjs', '--install'], {
    cwd: root,
    stdio: 'inherit',
  });
  child.on('exit', code => {
    running = false;
    if (code !== 0) console.error(`[watch] build failed with code ${code}`);
    if (rerun) runInstall('queued change');
  });
}

function schedule(reason) {
  clearTimeout(timer);
  timer = setTimeout(() => runInstall(reason), 120);
}

for (const file of watchedFiles) {
  fs.watch(file, { persistent: true }, () => {
    schedule(path.relative(root, file));
  });
}

runInstall('initial');
console.log(`[watch] watching ${watchedFiles.length} source files`);
