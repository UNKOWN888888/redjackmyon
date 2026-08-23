import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPartial } from './helpers/load-partial.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

{
  const now = Date.now();
  const storedLogs = [
    { sequence: 3, at: now - 100, message: 'recent', level: 'warn', stage: 'blocked' },
    { sequence: 2, at: now - 200, message: 'recent older', level: 'info', stage: 'idle' },
    { sequence: 1, at: now - 25 * 60 * 60 * 1000, message: 'expired', level: 'info', stage: 'idle' },
  ];
  const configSandbox = loadPartial('01-config.js', {
    toInt: (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback,
    GM_getValue: (key, fallback) => key === 'betDebugLogRecentV1' ? storedLogs : fallback,
    GM_setValue: () => {},
    emptyPlan: () => ({}),
    loadRememberedSeatNumbers: () => [],
    Date,
  });
  const restored = configSandbox.loadRecentBetDebugLog();
  assert.deepEqual(Array.from(restored, item => item.message), ['recent', 'recent older']);
  assert.equal(restored[0].sessionId, 'legacy');
}

{
  const now = Date.now();
  const sandbox = loadPartial('02-diagnostics.js', {
    BET_DEBUG_LOG_LIMIT: 500,
    betDebugLog: [
      {
        sequence: 2,
        sessionId: 'current',
        scriptVersion: '1.92',
        at: now - 100,
        level: 'warn',
        stage: 'blocked',
        message: 'newest',
        data: { reason: 'test' },
      },
      {
        sequence: 1,
        sessionId: 'previous',
        scriptVersion: '1.91',
        at: now - 200,
        level: 'info',
        stage: 'place_chip',
        message: 'oldest',
        data: null,
      },
    ],
    setTimeout,
    clearTimeout,
  });

  const rows = sandbox.getRecentBetLogExportRows(true, now);
  assert.deepEqual(Array.from(rows, row => row.sequence), [1, 2]);
  assert.equal(rows[0].message, 'oldest');
  assert.equal(rows[1].message, 'newest');
  assert.equal(rows[1].stageLabel, '실행 중단');
  assert.equal(rows[1].ageMs, 100);
}

{
  let downloadDetails = null;
  let revokedUrl = null;
  const payload = {
    logWindow: { count: 2 },
    recentExecutionLogs: [{ sequence: 1 }, { sequence: 2 }],
  };
  const sandbox = loadPartial('02-diagnostics.js', {
    betDebugLog: [{ sequence: 1 }],
    setTimeout,
    clearTimeout,
    Blob,
    URL: {
      createObjectURL: () => 'blob:recent-log',
      revokeObjectURL: url => { revokedUrl = url; },
    },
    document: {
      body: { appendChild() {} },
      createElement() {
        throw new Error('browser fallback must not run when GM_download succeeds');
      },
    },
    GM_download(details) {
      downloadDetails = details;
      queueMicrotask(details.onload);
      return { abort() {} };
    },
  });
  sandbox.pushBetLog = () => {};
  sandbox.persistBetDebugLogNow = () => true;
  sandbox.getBetDebugExportPayload = () => payload;

  const result = await sandbox.exportBetDebugLog();
  assert.equal(result.method, 'tampermonkey_download');
  assert.equal(result.logCount, 2);
  assert.match(result.filename, /^autotrigger-betlog-.*\.json$/);
  assert.equal(downloadDetails.name, result.filename);
  assert.equal(downloadDetails.url, 'blob:recent-log');
  assert.equal(revokedUrl, 'blob:recent-log');
}

{
  let anchorClicks = 0;
  let clipboardText = '';
  let revokedUrl = '';
  const sandbox = loadPartial('02-diagnostics.js', {
    betDebugLog: [{ sequence: 1 }],
    setTimeout(callback) {
      callback();
      return 1;
    },
    clearTimeout() {},
    Blob,
    URL: {
      createObjectURL: () => 'blob:browser-fallback',
      revokeObjectURL: url => { revokedUrl = url; },
    },
    document: {
      body: { appendChild() {} },
      createElement(tag) {
        assert.equal(tag, 'a');
        return {
          style: {},
          click() { anchorClicks++; },
          remove() {},
        };
      },
    },
    GM_setClipboard(text) {
      clipboardText = text;
    },
  });
  sandbox.pushBetLog = () => {};
  sandbox.persistBetDebugLogNow = () => true;
  sandbox.getBetDebugExportPayload = () => ({
    logWindow: { count: 1 },
    recentExecutionLogs: [{ sequence: 1, message: 'recent failure' }],
  });

  const result = await sandbox.exportBetDebugLog();
  assert.equal(result.method, 'browser_download');
  assert.equal(result.copied, true, 'the old-loader fallback must also copy the JSON to the clipboard');
  assert.equal(anchorClicks, 1);
  assert.match(clipboardText, /recent failure/);
  assert.equal(revokedUrl, 'blob:browser-fallback');
}

const metaSource = fs.readFileSync(path.join(root, 'src', 'userscript.meta.js'), 'utf8');
const loaderSource = fs.readFileSync(path.join(root, 'loader', 'blackjackT-loader.user.js'), 'utf8');
assert.match(metaSource, /@grant\s+GM_download/);
assert.match(metaSource, /@grant\s+GM_setClipboard/);
assert.match(loaderSource, /@grant\s+GM_download/);
assert.match(loaderSource, /@grant\s+GM_setClipboard/);
assert.match(loaderSource, /'GM_download'[\s\S]*'GM_setClipboard'/);

console.log('recent log export regression tests passed');
